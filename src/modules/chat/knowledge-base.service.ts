import { QueryTypes, Transaction } from 'sequelize';
import { db } from '../../../config/database';
import AppError from '../../../utils/errorHandler';
import type { UserRole } from '../../../models/User.model';
import type { ChatUserContext, KnowledgeAccess, RagHit } from './chat.types';
import { cosineSimilarity, parseEmbeddingFromDb, vectorLiteral } from './embedding.service';

const JSONB_SCAN_CAP = 5000;

const parseAccess = (raw: unknown): KnowledgeAccess => {
  if (!raw || typeof raw !== 'object') {
    return { roles: [], flags: {} };
  }
  const o = raw as Record<string, unknown>;
  const roles = Array.isArray(o.roles) ? (o.roles.filter(r => typeof r === 'string') as UserRole[]) : [];
  const flags = o.flags && typeof o.flags === 'object' ? (o.flags as KnowledgeAccess['flags']) : {};
  return { roles, flags };
};

let cachedEmbeddingKind: 'vector' | 'jsonb' | null = null;

async function getEmbeddingStorageKind(): Promise<'vector' | 'jsonb'> {
  if (cachedEmbeddingKind) {
    return cachedEmbeddingKind;
  }
  const rows = (await db.sequelize.query(
    `SELECT udt_name AS "udtName"
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'knowledge_base'
       AND column_name = 'embedding'`,
    { type: QueryTypes.SELECT },
  )) as { udtName: string }[];
  const udt = rows[0]?.udtName;
  if (udt === 'vector') {
    cachedEmbeddingKind = 'vector';
  } else if (udt === 'jsonb') {
    cachedEmbeddingKind = 'jsonb';
  } else {
    throw new AppError('knowledge_base.embedding column missing or unsupported type. Run npm run migrate:chatbot.', 503);
  }
  return cachedEmbeddingKind;
}

export type UpsertKnowledgeInput = {
  chunkKey: string;
  contentText: string;
  embedding: number[];
  sourceType: string;
  sourceId?: string | null;
  universityId?: number | null;
  access: KnowledgeAccess;
  transaction?: Transaction;
};

export const upsertKnowledgeItem = async (input: UpsertKnowledgeInput): Promise<void> => {
  const accessJson = JSON.stringify(input.access);
  const kind = await getEmbeddingStorageKind();

  if (kind === 'vector') {
    const vec = vectorLiteral(input.embedding);
    await db.sequelize.query(
      `INSERT INTO knowledge_base (chunk_key, content_text, embedding, source_type, source_id, university_id, access)
       VALUES (:chunkKey, :contentText, :vec::vector, :sourceType, :sourceId, :universityId, :access::jsonb)
       ON CONFLICT (chunk_key) DO UPDATE SET
         content_text = EXCLUDED.content_text,
         embedding = EXCLUDED.embedding,
         source_type = EXCLUDED.source_type,
         source_id = EXCLUDED.source_id,
         university_id = EXCLUDED.university_id,
         access = EXCLUDED.access,
         updated_at = NOW()`,
      {
        replacements: {
          chunkKey: input.chunkKey,
          contentText: input.contentText,
          vec,
          sourceType: input.sourceType,
          sourceId: input.sourceId ?? null,
          universityId: input.universityId ?? null,
          access: accessJson,
        },
        type: QueryTypes.INSERT,
        transaction: input.transaction,
      },
    );
    return;
  }

  const embJson = JSON.stringify(input.embedding);
  await db.sequelize.query(
    `INSERT INTO knowledge_base (chunk_key, content_text, embedding, source_type, source_id, university_id, access)
     VALUES (:chunkKey, :contentText, :emb::jsonb, :sourceType, :sourceId, :universityId, :access::jsonb)
     ON CONFLICT (chunk_key) DO UPDATE SET
       content_text = EXCLUDED.content_text,
       embedding = EXCLUDED.embedding,
       source_type = EXCLUDED.source_type,
       source_id = EXCLUDED.source_id,
       university_id = EXCLUDED.university_id,
       access = EXCLUDED.access,
       updated_at = NOW()`,
    {
      replacements: {
        chunkKey: input.chunkKey,
        contentText: input.contentText,
        emb: embJson,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        universityId: input.universityId ?? null,
        access: accessJson,
      },
      type: QueryTypes.INSERT,
      transaction: input.transaction,
    },
  );
};

export type SearchKnowledgeOptions = {
  limit?: number;
  /** Minimum cosine similarity (0–1) to include a hit in chat context */
  minSimilarity?: number;
  /** Exclude recommendation-index chunks (rec_*) — used by course-match API only */
  excludeRecommendationChunks?: boolean;
};

const filterReplacements = (
  userContext: ChatUserContext,
): {
  roleJson: string;
  isStudent: boolean;
  counsellingDone: boolean;
  uniFilter: boolean;
  uniId: number;
} => {
  const roleJson = JSON.stringify([userContext.role]);
  const isStudent = userContext.role === 'student';
  const counsellingDone = Boolean(userContext.counsellingCompletedAt);
  const uniId = userContext.universityId;
  return {
    roleJson,
    isStudent,
    counsellingDone,
    uniFilter: userContext.role === 'university' && uniId !== null,
    uniId: uniId ?? -1,
  };
};

/**
 * Cosine similarity search: pgvector when available, else in-memory over JSONB rows (dev).
 */
export const searchSimilarKnowledge = async (
  queryEmbedding: number[],
  userContext: ChatUserContext,
  options: SearchKnowledgeOptions = {},
): Promise<RagHit[]> => {
  const limit = Math.min(Math.max(options.limit ?? 8, 1), 24);
  const minSimilarity = options.minSimilarity ?? 0.38;
  const excludeRec = options.excludeRecommendationChunks !== false;
  const vec = vectorLiteral(queryEmbedding);
  const { roleJson, isStudent, counsellingDone, uniFilter, uniId } = filterReplacements(userContext);
  const kind = await getEmbeddingStorageKind();

  if (kind === 'vector') {
    const rows = (await db.sequelize.query(
      `SELECT k.id, k.chunk_key AS "chunkKey", k.content_text AS "contentText",
              k.source_type AS "sourceType", k.source_id AS "sourceId",
              k.university_id AS "universityId", k.access,
              (1 - (k.embedding <=> :vec::vector)) AS similarity
       FROM knowledge_base k
       WHERE (k.access->'roles') @> :roleJson::jsonb
         AND (
           :isStudent::boolean = false
           OR COALESCE((k.access->'flags'->>'commission'), 'false') <> 'true'
         )
         AND (
           :isStudent::boolean = false
           OR :counsellingDone::boolean = true
           OR COALESCE((k.access->'flags'->>'university_named'), 'false') <> 'true'
         )
         AND (
           :uniFilter::boolean = false
           OR k.university_id IS NULL
           OR k.university_id = :uniId
         )
         AND (
           :excludeRec::boolean = false
           OR k.source_type NOT LIKE 'rec\\_%'
         )
       ORDER BY k.embedding <=> :vec::vector
       LIMIT :limit`,
      {
        replacements: {
          vec,
          roleJson,
          isStudent,
          counsellingDone,
          uniFilter,
          uniId,
          excludeRec,
          limit,
        },
        type: QueryTypes.SELECT,
      },
    )) as Record<string, unknown>[];

    return rows
      .map(r => ({
        id: Number(r.id),
        chunkKey: String(r.chunkKey),
        contentText: String(r.contentText),
        sourceType: String(r.sourceType),
        sourceId: r.sourceId !== undefined && r.sourceId !== null ? String(r.sourceId) : null,
        universityId: r.universityId !== undefined && r.universityId !== null ? Number(r.universityId) : null,
        access: parseAccess(r.access),
        similarity: Number(r.similarity),
      }))
      .filter(h => h.similarity >= minSimilarity);
  }

  const wide = (await db.sequelize.query(
    `SELECT k.id, k.chunk_key AS "chunkKey", k.content_text AS "contentText",
            k.source_type AS "sourceType", k.source_id AS "sourceId",
            k.university_id AS "universityId", k.access, k.embedding AS "embeddingRaw"
     FROM knowledge_base k
     WHERE (k.access->'roles') @> :roleJson::jsonb
       AND (
         :isStudent::boolean = false
         OR COALESCE((k.access->'flags'->>'commission'), 'false') <> 'true'
       )
       AND (
         :isStudent::boolean = false
         OR :counsellingDone::boolean = true
         OR COALESCE((k.access->'flags'->>'university_named'), 'false') <> 'true'
       )
       AND (
         :uniFilter::boolean = false
         OR k.university_id IS NULL
         OR k.university_id = :uniId
       )
       AND (
         :excludeRec::boolean = false
         OR k.source_type NOT LIKE 'rec\\_%'
       )
     LIMIT :cap`,
    {
      replacements: {
        roleJson,
        isStudent,
        counsellingDone,
        uniFilter,
        uniId,
        excludeRec,
        cap: JSONB_SCAN_CAP,
      },
      type: QueryTypes.SELECT,
    },
  )) as Record<string, unknown>[];

  const scored = wide
    .map(r => {
      const emb = parseEmbeddingFromDb(r.embeddingRaw);
      const similarity = cosineSimilarity(queryEmbedding, emb);
      return { r, similarity };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .filter(({ similarity }) => similarity >= minSimilarity)
    .slice(0, limit);

  return scored.map(({ r, similarity }) => ({
    id: Number(r.id),
    chunkKey: String(r.chunkKey),
    contentText: String(r.contentText),
    sourceType: String(r.sourceType),
    sourceId: r.sourceId !== undefined && r.sourceId !== null ? String(r.sourceId) : null,
    universityId: r.universityId !== undefined && r.universityId !== null ? Number(r.universityId) : null,
    access: parseAccess(r.access),
    similarity,
  }));
};

/** Extra redaction before sending snippets to the model */
export const sanitizeKnowledgeSnippets = (hits: RagHit[], userContext: ChatUserContext): string[] => {
  const isStudent = userContext.role === 'student';
  const hideUniNames = isStudent && !userContext.counsellingCompletedAt;

  return hits.map(h => {
    let t = h.contentText;
    if (isStudent && h.access.flags?.commission) {
      return '[restricted]';
    }
    if (hideUniNames && h.access.flags?.university_named) {
      t = t.replace(/University:\s*[^\n.]+/gi, 'University: [available after counselling]');
    }
    return t;
  });
};

export type SearchRecommendationOptions = {
  limit?: number;
  sourceTypes?: string[];
};

const RECOMMENDATION_SOURCE_TYPES = ['rec_catalog', 'rec_scrape', 'rec_fee_range', 'rec_career', 'rec_commission'];

const recommendationContextForAudience = (audience: 'public' | 'agent'): ChatUserContext => ({
  userId: 'recommendation',
  role: audience === 'agent' ? 'agent' : 'student',
  agentProfileId: null,
  universityId: null,
  universityName: null,
  studentProfileId: null,
  counsellingCompletedAt: audience === 'public' ? null : new Date(),
});

/**
 * Vector search scoped to recommendation chunks (rec_* source types).
 * Public audience uses student role with counselling incomplete (excludes commission chunks).
 */
export const searchRecommendationKnowledge = async (
  queryEmbedding: number[],
  audience: 'public' | 'agent',
  options: SearchRecommendationOptions = {},
): Promise<RagHit[]> => {
  const limit = Math.min(Math.max(options.limit ?? 12, 1), 24);
  const sourceTypes = options.sourceTypes ?? RECOMMENDATION_SOURCE_TYPES;
  const userContext = recommendationContextForAudience(audience);
  const vec = vectorLiteral(queryEmbedding);
  const { roleJson, isStudent, counsellingDone, uniFilter, uniId } = filterReplacements(userContext);
  const sourceTypesJson = JSON.stringify(sourceTypes);
  const kind = await getEmbeddingStorageKind();

  const mapRow = (r: Record<string, unknown>, similarity: number): RagHit => ({
    id: Number(r.id),
    chunkKey: String(r.chunkKey),
    contentText: String(r.contentText),
    sourceType: String(r.sourceType),
    sourceId: r.sourceId !== undefined && r.sourceId !== null ? String(r.sourceId) : null,
    universityId: r.universityId !== undefined && r.universityId !== null ? Number(r.universityId) : null,
    access: parseAccess(r.access),
    similarity,
  });

  if (kind === 'vector') {
    const rows = (await db.sequelize.query(
      `SELECT k.id, k.chunk_key AS "chunkKey", k.content_text AS "contentText",
              k.source_type AS "sourceType", k.source_id AS "sourceId",
              k.university_id AS "universityId", k.access,
              (1 - (k.embedding <=> :vec::vector)) AS similarity
       FROM knowledge_base k
       WHERE k.source_type = ANY(ARRAY(SELECT jsonb_array_elements_text(:sourceTypesJson::jsonb)))
         AND (k.access->'roles') @> :roleJson::jsonb
         AND (
           :isStudent::boolean = false
           OR COALESCE((k.access->'flags'->>'commission'), 'false') <> 'true'
         )
         AND (
           :isStudent::boolean = false
           OR :counsellingDone::boolean = true
           OR COALESCE((k.access->'flags'->>'university_named'), 'false') <> 'true'
           OR k.source_type IN ('rec_catalog', 'rec_scrape', 'rec_fee_range')
         )
         AND (
           :uniFilter::boolean = false
           OR k.university_id IS NULL
           OR k.university_id = :uniId
         )
       ORDER BY k.embedding <=> :vec::vector
       LIMIT :limit`,
      {
        replacements: {
          vec,
          sourceTypesJson,
          roleJson,
          isStudent,
          counsellingDone,
          uniFilter,
          uniId,
          limit,
        },
        type: QueryTypes.SELECT,
      },
    )) as Record<string, unknown>[];

    return rows.map(r => mapRow(r, Number(r.similarity)));
  }

  const wide = (await db.sequelize.query(
    `SELECT k.id, k.chunk_key AS "chunkKey", k.content_text AS "contentText",
            k.source_type AS "sourceType", k.source_id AS "sourceId",
            k.university_id AS "universityId", k.access, k.embedding AS "embeddingRaw"
     FROM knowledge_base k
     WHERE k.source_type = ANY(ARRAY(SELECT jsonb_array_elements_text(:sourceTypesJson::jsonb)))
       AND (k.access->'roles') @> :roleJson::jsonb
       AND (
         :isStudent::boolean = false
         OR COALESCE((k.access->'flags'->>'commission'), 'false') <> 'true'
       )
       AND (
         :isStudent::boolean = false
         OR :counsellingDone::boolean = true
         OR COALESCE((k.access->'flags'->>'university_named'), 'false') <> 'true'
         OR k.source_type IN ('rec_catalog', 'rec_scrape', 'rec_fee_range')
       )
       AND (
         :uniFilter::boolean = false
         OR k.university_id IS NULL
         OR k.university_id = :uniId
       )
     LIMIT :cap`,
    {
      replacements: {
        sourceTypesJson,
        roleJson,
        isStudent,
        counsellingDone,
        uniFilter,
        uniId,
        cap: JSONB_SCAN_CAP,
      },
      type: QueryTypes.SELECT,
    },
  )) as Record<string, unknown>[];

  return wide
    .map(r => {
      const emb = parseEmbeddingFromDb(r.embeddingRaw);
      const similarity = cosineSimilarity(queryEmbedding, emb);
      return mapRow(r, similarity);
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
};

export const assertKnowledgeBaseReady = async (): Promise<void> => {
  try {
    await db.sequelize.query(`SELECT 1 AS ok FROM knowledge_base LIMIT 1`, {
      type: QueryTypes.SELECT,
    });
  } catch {
    throw new AppError(
      'Knowledge base is not available. Run `npm run migrate:chatbot`, set OPENAI_API_KEY, then `npm run sync:chat-knowledge` (or POST /api/v1/admin/chat/knowledge/sync).',
      503,
    );
  }
  try {
    await getEmbeddingStorageKind();
  } catch (e: unknown) {
    if (e instanceof AppError) {
      throw e;
    }
    throw new AppError('Knowledge base schema is invalid. Run `npm run migrate:chatbot` again.', 503);
  }
};

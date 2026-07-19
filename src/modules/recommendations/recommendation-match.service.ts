import { embedText } from '../chat/embedding.service';
import { assertKnowledgeBaseReady, searchRecommendationKnowledge } from '../chat/knowledge-base.service';
import { buildCandidatePool } from './candidate-pool.service';
import { levelMatchesProgram, normalizeAgentInput, normalizePublicInput } from './input-normalizer.service';
import { pickCandidatesWithLlm } from './recommendation-llm.service';
import { buildAgentPathways, buildPublicSuggestions, wrapAgentResponse, wrapMatchResponse } from './recommendation-response.service';
import { intersectWithVectorHits, rerankCandidates } from './recommendation-rerank.service';
import { boostCandidatesFromContextHits } from './scrape-context.service';
import type { AgentMatchBody, NormalizedMatchInput, PublicMatchBody, RecommendationCandidate } from './recommendation.types';
import { ragHitToRefId } from './recommendation.types';

const buildRefSimilarityMap = (
  hits: Awaited<ReturnType<typeof searchRecommendationKnowledge>>,
): Map<string, number> => {
  const m = new Map<string, number>();
  for (const h of hits) {
    const refId = ragHitToRefId(h.sourceType, h.sourceId, h.universityId);
    if (!refId) continue;
    const prev = m.get(refId) ?? 0;
    if (h.similarity > prev) m.set(refId, h.similarity);
  }
  return m;
};

const loadPoolWithRelaxation = async (input: NormalizedMatchInput): Promise<RecommendationCandidate[]> => {
  let pool = await buildCandidatePool(input);
  if (pool.length) return pool;

  // Retry without field filters — keep academic level strict (never drop UG/PG band).
  if (input.fieldKeywords.length) {
    pool = await buildCandidatePool({
      ...input,
      fieldKeywords: [],
      programFocusWords: input.programFocusWords,
    });
  }
  return pool;
};

const enforceLevel = (
  candidates: RecommendationCandidate[],
  input: NormalizedMatchInput,
): RecommendationCandidate[] => {
  if (!input.wantedBand || input.wantedBand === 'any') return candidates;
  return candidates.filter(c => levelMatchesProgram(c.courseName, c.degree, input.wantedBand));
};

const preferNamedPrograms = (candidates: RecommendationCandidate[]): RecommendationCandidate[] => {
  const named = candidates.filter(c => c.source === 'catalog' || c.source === 'scrape');
  return named.length ? named : candidates.filter(c => c.source !== 'fee_range');
};

const diversifyByTitle = (
  picks: { refId: string; matchReasons: string[] }[],
  ranked: RecommendationCandidate[],
  pickCount: number,
): { refId: string; matchReasons: string[] }[] => {
  const byRef = new Map(ranked.map(c => [c.refId, c]));
  const seen = new Set<string>();
  const out: { refId: string; matchReasons: string[] }[] = [];

  const tryAdd = (pick: { refId: string; matchReasons: string[] }) => {
    const c = byRef.get(pick.refId);
    if (!c) return;
    const key = c.courseName.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(pick);
  };

  for (const pick of picks) {
    if (out.length >= pickCount) break;
    tryAdd(pick);
  }

  if (out.length < pickCount) {
    for (const c of ranked) {
      if (out.length >= pickCount) break;
      tryAdd({
        refId: c.refId,
        matchReasons: [`Matches your ${c.degree} level preference`, `Available in ${c.country}`],
      });
    }
  }

  return out;
};

const safeEmbed = async (text: string): Promise<number[] | null> => {
  try {
    return await embedText(text);
  } catch {
    return null;
  }
};

export const matchPublicRecommendations = async (body: PublicMatchBody) => {
  await assertKnowledgeBaseReady();
  const input = normalizePublicInput(body);

  const [pool, embedding] = await Promise.all([loadPoolWithRelaxation(input), safeEmbed(input.querySummary)]);

  let hits: Awaited<ReturnType<typeof searchRecommendationKnowledge>> = [];
  if (embedding) {
    try {
      hits = await searchRecommendationKnowledge(embedding, 'public', { limit: 16 });
    } catch {
      hits = [];
    }
  }

  const refSimilarity = await boostCandidatesFromContextHits(pool, hits, buildRefSimilarityMap(hits));
  let merged = enforceLevel(preferNamedPrograms(intersectWithVectorHits(pool, refSimilarity, 'public')), input);
  if (!merged.length) merged = enforceLevel(preferNamedPrograms(pool), input);

  const reranked = enforceLevel(rerankCandidates(merged, input, 'public', 8), input);
  const ranked = reranked.length ? reranked : merged;
  const pickCount = Math.min(4, Math.max(1, ranked.length >= 3 ? 4 : ranked.length));
  let picks: Awaited<ReturnType<typeof pickCandidatesWithLlm>> = [];
  try {
    picks = await pickCandidatesWithLlm(ranked, pickCount, input.querySummary);
  } catch {
    picks = ranked.slice(0, pickCount).map(c => ({
      refId: c.refId,
      matchReasons: [`Matches your ${c.degree} level preference`, `Available in ${c.country}`],
    }));
  }
  const validIds = new Set(ranked.map(c => c.refId));
  picks = picks.filter(p => validIds.has(p.refId));
  if (!picks.length && ranked.length) {
    picks = ranked.slice(0, pickCount).map(c => ({
      refId: c.refId,
      matchReasons: [`Matches your ${input.level} level preference`, `Available in ${c.country}`],
    }));
  }
  picks = diversifyByTitle(picks, ranked, pickCount);
  const suggestions = buildPublicSuggestions(picks, ranked, input);

  return wrapMatchResponse(suggestions);
};

export const matchAgentRecommendations = async (body: AgentMatchBody) => {
  await assertKnowledgeBaseReady();
  const input = normalizeAgentInput(body);
  const limit = Math.min(4, Math.max(1, body.limit ?? 2));

  const [pool, embedding] = await Promise.all([loadPoolWithRelaxation(input), safeEmbed(input.querySummary)]);

  let hits: Awaited<ReturnType<typeof searchRecommendationKnowledge>> = [];
  if (embedding) {
    try {
      hits = await searchRecommendationKnowledge(embedding, 'agent', { limit: 24 });
    } catch {
      hits = [];
    }
  }

  const refSimilarity = await boostCandidatesFromContextHits(pool, hits, buildRefSimilarityMap(hits));
  let merged = enforceLevel(intersectWithVectorHits(pool, refSimilarity, 'agent'), input);
  if (!merged.length) merged = enforceLevel(pool, input);

  const reranked = enforceLevel(rerankCandidates(merged, input, 'agent', 12), input);
  const ranked = reranked.length ? reranked : merged;
  let picks: Awaited<ReturnType<typeof pickCandidatesWithLlm>> = [];
  try {
    picks = await pickCandidatesWithLlm(ranked, limit, input.querySummary, 'agent');
  } catch {
    picks = ranked.slice(0, limit).map(c => ({
      refId: c.refId,
      matchReasons: [
        `Program aligns with agent search focus`,
        c.universityName ? `At ${c.universityName} in ${c.country}` : `Available in ${c.country}`,
      ],
    }));
  }
  const validIds = new Set(ranked.map(c => c.refId));
  picks = picks.filter(p => validIds.has(p.refId));
  if (!picks.length && ranked.length) {
    picks = ranked.slice(0, limit).map(c => ({
      refId: c.refId,
      matchReasons: [
        `Program aligns with agent search focus`,
        c.universityName ? `At ${c.universityName} in ${c.country}` : `Available in ${c.country}`,
      ],
    }));
  }
  const candidateMap = new Map(ranked.map(c => [c.refId, c]));
  for (const c of merged) {
    if (!candidateMap.has(c.refId)) candidateMap.set(c.refId, c);
  }
  const pathways = buildAgentPathways(picks, [...candidateMap.values()], input);

  return wrapAgentResponse(pathways);
};

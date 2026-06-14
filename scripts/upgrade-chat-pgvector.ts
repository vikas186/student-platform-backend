/**
 * Upgrades chat knowledge_base from JSONB embeddings to pgvector on the app database.
 * Safe when knowledge_base is empty or you are OK re-syncing embeddings afterward.
 *
 * Usage: npm run upgrade:chat-pgvector
 */
import dotenv from 'dotenv';
import path from 'path';
import { Sequelize, QueryTypes } from 'sequelize';

const envFile = path.join(__dirname, '..', 'config', `.env.${process.env.NODE_ENV || 'development'}`);
dotenv.config({ path: envFile });

const { DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;

async function getEmbeddingKind(sequelize: Sequelize): Promise<'vector' | 'jsonb' | 'missing'> {
  const cols = await sequelize.query<{ udt_name: string }>(
    `SELECT udt_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'knowledge_base' AND column_name = 'embedding'`,
    { type: QueryTypes.SELECT },
  );
  if (!cols.length) return 'missing';
  if (cols[0].udt_name === 'vector') return 'vector';
  if (cols[0].udt_name === 'jsonb') return 'jsonb';
  throw new Error(`Unsupported embedding column type: ${cols[0].udt_name}`);
}

async function main() {
  if (!DB_HOST || !DB_USERNAME || !DB_PASSWORD || !DB_NAME) {
    console.error(`Missing DB_* variables. Expected file: ${envFile}`);
    process.exit(1);
  }

  const sequelize = new Sequelize(DB_NAME, DB_USERNAME, DB_PASSWORD, {
    host: DB_HOST,
    port: parseInt(DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: false,
  });

  await sequelize.authenticate();
  console.log('Connected to DB:', DB_NAME);

  const ext = await sequelize.query<{ extname: string }>(
    `SELECT extname FROM pg_extension WHERE extname = 'vector'`,
    { type: QueryTypes.SELECT },
  );
  if (!ext.length) {
    console.log('Creating pgvector extension on', DB_NAME, '...');
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS vector');
  } else {
    console.log('pgvector extension already enabled on', DB_NAME);
  }

  const kind = await getEmbeddingKind(sequelize);
  if (kind === 'vector') {
    console.log('knowledge_base already uses vector(1536). Nothing to upgrade.');
    await sequelize.close();
    return;
  }

  if (kind === 'jsonb') {
    const rows = await sequelize.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM knowledge_base`,
      { type: QueryTypes.SELECT },
    );
    const count = parseInt(rows[0]?.count ?? '0', 10);
    if (count > 0) {
      console.error(
        `knowledge_base has ${count} rows with JSONB embeddings. Re-run after backup or run sync:chat-knowledge to repopulate after upgrade.`,
      );
      process.exit(1);
    }
    console.log('Dropping JSONB knowledge_base table (empty)...');
    await sequelize.query('DROP TABLE IF EXISTS knowledge_base CASCADE');
  }

  const kbSql = `
CREATE TABLE IF NOT EXISTS knowledge_base (
  id BIGSERIAL PRIMARY KEY,
  chunk_key TEXT NOT NULL UNIQUE,
  content_text TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NULL,
  university_id INT NULL REFERENCES universities(id) ON DELETE CASCADE,
  access JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_university_id ON knowledge_base(university_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_source ON knowledge_base(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding_ivfflat
  ON knowledge_base USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
`;

  await sequelize.query(kbSql);
  console.log('Created knowledge_base with vector(1536) + IVFFlat index.');

  const verify = await getEmbeddingKind(sequelize);
  if (verify !== 'vector') {
    throw new Error('Upgrade verification failed: embedding column is not vector');
  }

  console.log('Upgrade complete. Run: npm run sync:chat-knowledge');
  await sequelize.close();
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

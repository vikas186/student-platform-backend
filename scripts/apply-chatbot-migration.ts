/**
 * Applies chatbot schema: tries pgvector migration first; if the `vector` extension
 * is not installed (common on Windows), applies JSONB embedding fallback instead.
 *
 * Usage: npm run migrate:chatbot
 */
import dotenv from 'dotenv';
import path from 'path';
import fsSync from 'fs';
import { Sequelize } from 'sequelize';

const envFile = path.join(__dirname, '..', 'config', `.env.${process.env.NODE_ENV || 'development'}`);
dotenv.config({ path: envFile });

const { DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;

function isPgVectorUnavailableError(e: unknown): boolean {
  const msg = String((e as { parent?: { message?: string } })?.parent?.message || (e as Error)?.message || '');
  return (
    msg.includes('extension "vector" is not available') || msg.includes('must first be installed on the system where PostgreSQL is running')
  );
}

async function main() {
  if (!DB_HOST || !DB_USERNAME || !DB_PASSWORD || !DB_NAME) {
    console.error(`Missing DB_* variables. Expected file: ${envFile}`);
    process.exit(1);
  }

  const pgvectorPath = path.join(__dirname, '..', 'migrations', '001_chatbot_pgvector.sql');
  const jsonbPath = path.join(__dirname, '..', 'migrations', '001_chatbot_jsonb_embeddings.sql');
  const pgvectorSql = fsSync.readFileSync(pgvectorPath, 'utf8');
  const jsonbSql = fsSync.readFileSync(jsonbPath, 'utf8');

  const sequelize = new Sequelize(DB_NAME, DB_USERNAME, DB_PASSWORD, {
    host: DB_HOST,
    port: parseInt(DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: false,
  });

  await sequelize.authenticate();

  try {
    await sequelize.query(pgvectorSql);
    console.log('Applied (pgvector):', pgvectorPath);
  } catch (e: unknown) {
    if (!isPgVectorUnavailableError(e)) {
      throw e;
    }
    console.warn(
      '[migrate:chatbot] PostgreSQL does not have the pgvector extension. Applying JSONB embedding fallback (OK for development).',
    );
    console.warn('[migrate:chatbot] For production similarity search at scale, install pgvector and re-run with 001_chatbot_pgvector.sql.');
    await sequelize.query(jsonbSql);
    console.log('Applied (JSONB fallback):', jsonbPath);
  }

  await sequelize.close();
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

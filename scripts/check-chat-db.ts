/**
 * One-off diagnostic: pgvector + knowledge_base column type on app DB.
 */
import dotenv from 'dotenv';
import path from 'path';
import { Sequelize, QueryTypes } from 'sequelize';

const envFile = path.join(__dirname, '..', 'config', `.env.${process.env.NODE_ENV || 'development'}`);
dotenv.config({ path: envFile });

const { DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;

async function main() {
  if (!DB_HOST || !DB_USERNAME || !DB_PASSWORD || !DB_NAME) {
    console.error('Missing DB_* env vars');
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
  console.log('pgvector extension:', ext.length ? 'installed' : 'NOT installed');

  const tableExists = await sequelize.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'knowledge_base'`,
    { type: QueryTypes.SELECT },
  );

  if (tableExists[0]?.count !== '1') {
    console.log('knowledge_base table: missing');
    await sequelize.close();
    return;
  }

  const cols = await sequelize.query<{ column_name: string; udt_name: string; data_type: string }>(
    `SELECT column_name, udt_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'knowledge_base' AND column_name = 'embedding'`,
    { type: QueryTypes.SELECT },
  );
  console.log('knowledge_base.embedding type:', cols[0]?.udt_name ?? 'missing', `(${cols[0]?.data_type ?? 'n/a'})`);

  const rows = await sequelize.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM knowledge_base`,
    { type: QueryTypes.SELECT },
  );
  console.log('knowledge_base row count:', rows[0]?.count ?? '0');

  await sequelize.close();
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

/**
 * Applies scrape schema (005–009 in order).
 * Usage: npm run migrate:scrape
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Sequelize } from 'sequelize';

const envFile = path.join(__dirname, '..', 'config', `.env.${process.env.NODE_ENV || 'development'}`);
dotenv.config({ path: envFile });

const { DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;

async function runSql(sequelize: Sequelize, filename: string): Promise<void> {
  const sqlPath = path.join(__dirname, '..', 'migrations', filename);
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await sequelize.query(sql);
  console.log('Applied:', sqlPath);
}

async function main(): Promise<void> {
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
  await runSql(sequelize, '005_idp_aecc_scrape.sql');
  await runSql(sequelize, '006_generic_scrape_targets.sql');
  await runSql(sequelize, '007_multi_entity_scrape.sql');
  await runSql(sequelize, '008_scrape_ai_enrichment.sql');
  await runSql(sequelize, '009_scrape_ai_meta_job_fk.sql');
  await runSql(sequelize, '010_scrape_jobs_status_enum.sql');
  await sequelize.close();
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

/**
 * Applies notice ticker schema (migration 013).
 * Usage: npm run migrate:notices
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Sequelize } from 'sequelize';

const envFile = path.join(__dirname, '..', 'config', `.env.${process.env.NODE_ENV || 'development'}`);
dotenv.config({ path: envFile });

const { DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;

async function main() {
  if (!DB_HOST || !DB_USERNAME || !DB_PASSWORD || !DB_NAME) {
    console.error(`Missing DB_* variables. Expected file: ${envFile}`);
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '..', 'migrations', '013_notice_ticker.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const sequelize = new Sequelize(DB_NAME, DB_USERNAME, DB_PASSWORD, {
    host: DB_HOST,
    port: parseInt(DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: false,
  });

  await sequelize.authenticate();
  await sequelize.query(sql);
  console.log('Applied:', sqlPath);
  await sequelize.close();
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

/**
 * Marks in-flight scrape jobs as failed/cancelled.
 * Usage: npm run scrape:cancel
 */
import dotenv from 'dotenv';
import path from 'path';
import { Sequelize } from 'sequelize';

const envFile = path.join(__dirname, '..', 'config', `.env.${process.env.NODE_ENV || 'development'}`);
dotenv.config({ path: envFile });

const { DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;

const ACTIVE = ['pending', 'running', 'scraping', 'pending_cleaning', 'cleaning'];

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

  const [, count] = await sequelize.query(
    `
    UPDATE scrape_jobs
    SET status = 'failed',
        error_message = 'Cancelled by admin',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE status::text = ANY($1::text[])
    `,
    { bind: [ACTIVE] },
  );

  const updated = typeof count === 'number' ? count : (count as unknown as { rowCount?: number })?.rowCount ?? 0;
  console.log(`Cancelled ${updated} active scrape job(s).`);
  await sequelize.close();
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

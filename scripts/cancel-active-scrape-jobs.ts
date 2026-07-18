/**
 * Marks in-flight scrape jobs as failed/cancelled.
 * Usage (from repo root):
 *   NODE_ENV=production node dist/scripts/cancel-active-scrape-jobs.js
 */
import fs from 'fs';
import path from 'path';
import { Sequelize } from 'sequelize';

const ACTIVE = ['pending', 'running', 'scraping', 'pending_cleaning', 'cleaning'];

/** Load config/.env.* without requiring the dotenv package (prod may have a thin node_modules). */
function loadEnvFile(envName: string): string {
  const envFile = path.resolve(process.cwd(), 'config', `.env.${envName}`);
  if (!fs.existsSync(envFile)) {
    return envFile;
  }
  const text = fs.readFileSync(envFile, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return envFile;
}

async function main(): Promise<void> {
  const envName = process.env.NODE_ENV || 'development';
  const envFile = loadEnvFile(envName);

  const { DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;

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

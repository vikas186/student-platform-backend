/**
 * Ask a running scrape job to stop after in-flight universities finish,
 * then save partial results and queue cleaning.
 *
 * Usage (from repo root):
 *   NODE_ENV=production node dist/scripts/finalize-scrape-early.js
 *   NODE_ENV=production node dist/scripts/finalize-scrape-early.js <jobId>
 */
import fs from 'fs';
import path from 'path';
import { Sequelize } from 'sequelize';

function loadEnvFile(envName: string): string {
  const envFile = path.resolve(process.cwd(), 'config', `.env.${envName}`);
  if (!fs.existsSync(envFile)) return envFile;
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
  const envFile = loadEnvFile(process.env.NODE_ENV || 'development');
  const { DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;
  const jobIdArg = process.argv[2];

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

  const [rows] = await sequelize.query(
    jobIdArg
      ? `SELECT id, status, stats FROM scrape_jobs WHERE id = $1`
      : `SELECT id, status, stats FROM scrape_jobs
         WHERE status::text IN ('scraping', 'running')
         ORDER BY created_at DESC
         LIMIT 1`,
    jobIdArg ? { bind: [jobIdArg] } : undefined,
  );

  const job = (rows as Array<{ id: string; status: string; stats: Record<string, unknown> }>)[0];
  if (!job) {
    console.error('No scraping/running job found.');
    await sequelize.close();
    process.exit(1);
  }

  if (!['scraping', 'running'].includes(job.status)) {
    console.error(`Job ${job.id} is ${job.status}, not scraping.`);
    await sequelize.close();
    process.exit(1);
  }

  const nextStats: Record<string, unknown> = {
    ...(job.stats || {}),
    stopRequested: true,
    stopRequestedAt: new Date().toISOString(),
  };

  await sequelize.query(
    `UPDATE scrape_jobs
     SET stats = $1::jsonb,
         updated_at = NOW()
     WHERE id = $2`,
    { bind: [JSON.stringify(nextStats), job.id] },
  );

  console.log(`Stop requested for job ${job.id}.`);
  console.log('Worker will finish in-flight universities, save partial data, and queue cleaning.');
  console.log(
    `Progress so far: unis=${String(nextStats.universitiesFound ?? '?')} courses=${String(nextStats.coursesFound ?? '?')}`,
  );

  await sequelize.close();
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

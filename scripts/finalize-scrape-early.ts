/**
 * Ask a running scrape job to stop after in-flight universities finish,
 * then save partial results and queue cleaning.
 *
 * Requires scraper build that honors stats.stopRequested (shouldStop).
 *
 * Usage:
 *   NODE_ENV=production npx ts-node scripts/finalize-scrape-early.ts
 *   NODE_ENV=production npx ts-node scripts/finalize-scrape-early.ts <jobId>
 */
import dotenv from 'dotenv';
import path from 'path';
import { Sequelize } from 'sequelize';

const envFile = path.join(__dirname, '..', 'config', `.env.${process.env.NODE_ENV || 'development'}`);
dotenv.config({ path: envFile });

const { DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME, DB_PORT } = process.env;

async function main(): Promise<void> {
  if (!DB_HOST || !DB_USERNAME || !DB_PASSWORD || !DB_NAME) {
    console.error(`Missing DB_* variables. Expected file: ${envFile}`);
    process.exit(1);
  }

  const jobIdArg = process.argv[2];

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

  const nextStats = {
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
  console.log(
    'Worker will finish in-flight universities, save partial data, and queue cleaning.',
  );
  console.log(
    `Progress so far: unis=${nextStats.universitiesFound ?? '?'} courses=${nextStats.coursesFound ?? '?'}`,
  );

  await sequelize.close();
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

/**
 * Start a Studies Overseas scrape job (production/dev).
 * Usage: NODE_ENV=production npx ts-node scripts/start-studies-overseas-scrape.ts [maxDetail]
 */
import dotenv from 'dotenv';
import path from 'path';

const envName = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), 'config', `.env.${envName}`) });

async function main(): Promise<void> {
  const maxDetail = parseInt(process.argv[2] || process.env.SCRAPE_STUDIES_OVERSEAS_MAX_DETAIL || '120', 10);
  process.env.SCRAPE_STUDIES_OVERSEAS_MAX_DETAIL = String(maxDetail);

  const { db } = await import('../config/database');
  await db.sequelize.authenticate();

  const { resolveScrapeTarget } = await import('../src/modules/scrape/config/scrape-target.util');
  const { startScrapeJob } = await import('../src/modules/scrape/scrape.processor');

  const target = resolveScrapeTarget({ source: 'STUDIES_OVERSEAS' });
  target.maxDetailPages = maxDetail;

  const { jobId } = await startScrapeJob(target, 'manual');
  console.log(`Started STUDIES_OVERSEAS scrape job ${jobId} (maxDetail=${maxDetail})`);
  await db.sequelize.close();
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

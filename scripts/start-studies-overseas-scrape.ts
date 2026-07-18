/**
 * Start a Studies Overseas scrape job (production/dev).
 * Usage (from repo root):
 *   NODE_ENV=production node dist/scripts/start-studies-overseas-scrape.js [maxDetail]
 */
import fs from 'fs';
import path from 'path';

function loadEnvFile(envName: string): void {
  const envFile = path.resolve(process.cwd(), 'config', `.env.${envName}`);
  if (!fs.existsSync(envFile)) return;
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
}

async function main(): Promise<void> {
  const envName = process.env.NODE_ENV || 'development';
  loadEnvFile(envName);

  const maxDetail = parseInt(process.argv[2] || process.env.SCRAPE_STUDIES_OVERSEAS_MAX_DETAIL || '400', 10);
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

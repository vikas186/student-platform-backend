/**
 * Manually run AI notice ticker sync.
 * Usage: npm run sync:notices
 */
import dotenv from 'dotenv';
import path from 'path';

const envFile = path.join(__dirname, '..', 'config', `.env.${process.env.NODE_ENV || 'development'}`);
dotenv.config({ path: envFile });

async function main() {
  const { syncNoticesFromAi } = await import('../src/modules/notices/notice-ai.service');
  await import('../config/database');
  const result = await syncNoticesFromAi();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.errors.length && result.inserted === 0 ? 1 : 0);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

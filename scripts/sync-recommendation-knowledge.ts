/**
 * Re-indexes recommendation knowledge into pgvector (requires OPENAI_API_KEY).
 * Usage:
 *   npm run sync:recommendation-knowledge        (development)
 *   npm run prod:sync:recommendation-knowledge   (production)
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = path.join(__dirname, '..', 'config', `.env.${nodeEnv}`);
dotenv.config({ path: envFile });

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    const exists = fs.existsSync(envFile);
    console.error(
      `Set OPENAI_API_KEY in ${envFile} before syncing (NODE_ENV=${nodeEnv}, file ${exists ? 'found' : 'missing'}).`,
    );
    console.error('On the VPS use: npm run prod:sync:recommendation-knowledge');
    process.exit(1);
  }
  const { syncRecommendationKnowledgeBase } = await import('../src/modules/recommendations/recommendation-knowledge-sync.service');
  const result = await syncRecommendationKnowledgeBase();
  console.log('Recommendation knowledge sync complete:', result);
  if (result.bySource) {
    console.log('By source:', result.bySource);
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

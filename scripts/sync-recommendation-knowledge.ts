/**
 * Re-indexes recommendation knowledge into pgvector (requires OPENAI_API_KEY).
 * Usage: npm run sync:recommendation-knowledge
 */
import dotenv from 'dotenv';
import path from 'path';

const envFile = path.join(__dirname, '..', 'config', `.env.${process.env.NODE_ENV || 'development'}`);
dotenv.config({ path: envFile });

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error('Set OPENAI_API_KEY in your env file before syncing.');
    process.exit(1);
  }
  const { syncRecommendationKnowledgeBase } = await import('../src/modules/recommendations/recommendation-knowledge-sync.service');
  const result = await syncRecommendationKnowledgeBase();
  console.log('Recommendation knowledge sync complete:', result);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

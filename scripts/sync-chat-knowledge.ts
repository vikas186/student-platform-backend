/**
 * Runs embedding sync into knowledge_base (requires OPENAI_API_KEY).
 * Usage: cross-env NODE_ENV=development npx ts-node scripts/sync-chat-knowledge.ts
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
  const { syncKnowledgeBase } = await import('../src/modules/chat/knowledge-sync.service');
  const result = await syncKnowledgeBase();
  console.log('Knowledge sync complete:', result);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

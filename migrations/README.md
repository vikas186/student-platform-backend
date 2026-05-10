# Database migrations (manual)

This project uses raw SQL migrations (no Sequelize migrator).

1. **Chatbot schema** — from the project root:

   ```bash
   npm run migrate:chatbot
   ```

   This tries **`migrations/001_chatbot_pgvector.sql`** (requires the [pgvector](https://github.com/pgvector/pgvector) extension). If PostgreSQL reports that `vector` is not available (typical on Windows without pgvector), it automatically applies **`migrations/001_chatbot_jsonb_embeddings.sql`** instead (embeddings stored as JSONB; similarity is computed in the app — fine for development).

   Alternatively, run SQL manually with `psql` if you prefer.

2. After migration, an admin must populate embeddings (requires **`OPENAI_API_KEY`** in env):

   ```bash
   npm run sync:chat-knowledge
   ```

   Or call **`POST /api/v1/admin/chat/knowledge/sync`** with an admin JWT.

3. Legacy peer-to-peer chat rows (if any) live in **`peer_chat_messages`** after migration; AI chat uses **`chat_messages`**.

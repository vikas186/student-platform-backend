-- AI chatbot + pgvector knowledge base
-- Run against your PostgreSQL database (requires pgvector installed on server):
--   psql $DATABASE_URL -f migrations/001_chatbot_pgvector.sql

CREATE EXTENSION IF NOT EXISTS vector;

-- Legacy peer-to-peer chat table (sender/receiver) — free the name `chat_messages` for AI chat
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'chat_messages'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'peer_chat_messages'
  ) THEN
    ALTER TABLE chat_messages RENAME TO peer_chat_messages;
  END IF;
END $$;

-- Counselling gate for students (university names in chat/RAG)
ALTER TABLE student_profiles
  ADD COLUMN IF NOT EXISTS counselling_completed_at TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated ON chat_sessions(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS knowledge_base (
  id BIGSERIAL PRIMARY KEY,
  chunk_key TEXT NOT NULL UNIQUE,
  content_text TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NULL,
  university_id INT NULL REFERENCES universities(id) ON DELETE CASCADE,
  access JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_university_id ON knowledge_base(university_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_source ON knowledge_base(source_type, source_id);

-- IVFFlat index for cosine similarity (recreate after bulk load if needed)
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding_ivfflat
  ON knowledge_base USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS chat_feedback (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id BIGINT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL,
  comment TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_feedback_message_id ON chat_feedback(message_id);

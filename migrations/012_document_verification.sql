-- Document verification module
-- Run: npm run migrate:verification

CREATE TABLE IF NOT EXISTS passport_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  verification_session_id UUID REFERENCES verification_sessions(id) ON DELETE SET NULL,
  verification_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  confidence_score NUMERIC(5, 2),
  passport_number TEXT,
  full_name TEXT,
  nationality TEXT,
  date_of_birth DATE,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passport_verifications_user_id ON passport_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_passport_verifications_status ON passport_verifications(status);

CREATE TABLE IF NOT EXISTS academic_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  document_type TEXT NOT NULL,
  file_url TEXT,
  file_hash TEXT,
  ocr_text TEXT,
  student_name TEXT,
  institution_name TEXT,
  degree TEXT,
  course TEXT,
  passing_year TEXT,
  cgpa TEXT,
  ocr_confidence NUMERIC(5, 2),
  verification_status TEXT NOT NULL DEFAULT 'pending',
  duplicate_of_id UUID REFERENCES academic_documents(id) ON DELETE SET NULL,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_academic_documents_user_id ON academic_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_academic_documents_type ON academic_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_academic_documents_status ON academic_documents(verification_status);

CREATE TABLE IF NOT EXISTS bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  file_url TEXT,
  file_hash TEXT,
  ocr_text TEXT,
  account_holder_name TEXT,
  bank_name TEXT,
  statement_date DATE,
  opening_balance TEXT,
  closing_balance TEXT,
  ocr_confidence NUMERIC(5, 2),
  verification_status TEXT NOT NULL DEFAULT 'pending',
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bank_statements_user_id ON bank_statements(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_statements_status ON bank_statements(verification_status);

CREATE TABLE IF NOT EXISTS itr_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  file_url TEXT,
  file_hash TEXT,
  ocr_text TEXT,
  pan TEXT,
  taxpayer_name TEXT,
  assessment_year TEXT,
  total_income TEXT,
  ocr_confidence NUMERIC(5, 2),
  verification_status TEXT NOT NULL DEFAULT 'pending',
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_itr_documents_user_id ON itr_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_itr_documents_status ON itr_documents(verification_status);

CREATE TABLE IF NOT EXISTS verification_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_audit_entity ON verification_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_verification_audit_created ON verification_audit_log(created_at DESC);

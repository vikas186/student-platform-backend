-- AI-powered notice ticker: dedupe, source tracking, expiry
ALTER TABLE notice_ticker_items
  ADD COLUMN IF NOT EXISTS external_id VARCHAR(500),
  ADD COLUMN IF NOT EXISTS source_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS generated_by VARCHAR(20) NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notice_ticker_external_id
  ON notice_ticker_items (external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notice_ticker_expires
  ON notice_ticker_items (expires_at)
  WHERE expires_at IS NOT NULL;

-- Remove legacy seed / manual headlines before AI sync
DELETE FROM notice_ticker_items WHERE external_id IS NULL;

-- Notice ticker items shown in the dashboard announcement bar
CREATE TABLE IF NOT EXISTS notice_ticker_items (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  source VARCHAR(120) NOT NULL,
  href VARCHAR(500),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notice_ticker_items_active_sort
  ON notice_ticker_items (is_active, sort_order, id);

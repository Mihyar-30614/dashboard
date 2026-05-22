CREATE TABLE IF NOT EXISTS sql_widgets (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  data_source  TEXT NOT NULL,
  sql          TEXT NOT NULL,
  viz          TEXT NOT NULL CHECK (viz IN ('number','line','bar','table')),
  options      JSONB NOT NULL DEFAULT '{}',
  created_by   BIGINT REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sql_widgets_source ON sql_widgets(data_source);

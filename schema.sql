-- Dashboard DB schema. Fresh install:
--   createdb dashboard && psql dashboard < schema.sql
--
-- Hand-maintained; keep in sync with the live database. To check parity:
--   pg_dump --schema-only --no-owner --no-privileges dashboard   (diff against a scratch DB built from this file)
--
-- Dashboard-owned tables only. The seer app creates its own tables
-- (embeddings, query telemetry, saved queries, ...) in this database.

-- ---------------------------------------------------------------------------
-- Auth: users, cookie sessions, invite-based signup
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id            bigserial PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  is_admin      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE sessions (
  id         uuid PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  user_agent text
);

CREATE INDEX idx_sessions_exp ON sessions (expires_at);
CREATE INDEX idx_sessions_user ON sessions (user_id);

CREATE TABLE invites (
  id         bigserial PRIMARY KEY,
  token      text NOT NULL UNIQUE,
  email      text,
  created_by bigint REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at    timestamptz
);

-- ---------------------------------------------------------------------------
-- Dashboard: layouts, polled metric history, custom SQL widgets
-- ---------------------------------------------------------------------------

CREATE TABLE dashboard_layouts (
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  screen     text NOT NULL,
  layout     jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, screen)
);

CREATE TABLE metric_samples (
  app_slug text NOT NULL,
  metric   text NOT NULL,
  value    double precision NOT NULL,
  taken_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_samples_lookup ON metric_samples (app_slug, metric, taken_at DESC);

CREATE TABLE sql_widgets (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL,
  description text,
  data_source text NOT NULL,
  sql         text NOT NULL,
  viz         text NOT NULL CHECK (viz IN ('number', 'line', 'bar', 'table')),
  options     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by  bigint REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sql_widgets_source ON sql_widgets (data_source);

-- Ledger of applied migrations (kept for compatibility with earlier installs).
CREATE TABLE schema_migrations (
  filename   text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);


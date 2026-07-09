-- Dashboard DB schema. Fresh install:
--   createdb dashboard && psql dashboard < schema.sql
--
-- Hand-maintained; keep in sync with the live database. To check parity:
--   pg_dump --schema-only --no-owner --no-privileges dashboard   (diff against a scratch DB built from this file)

CREATE EXTENSION IF NOT EXISTS vector;

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

-- ---------------------------------------------------------------------------
-- Ask DB (seer): NL-to-SQL conversations, embeddings, saved queries,
-- query telemetry and learning signals
-- ---------------------------------------------------------------------------

CREATE TABLE conversation_history (
  id           serial PRIMARY KEY,
  question     text NOT NULL,
  sql_query    text,
  answer       text,
  result_count integer,
  created_at   timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX conversation_history_created_at_idx ON conversation_history (created_at DESC);

CREATE TABLE embeddings (
  id         serial PRIMARY KEY,
  doc_id     varchar(255) NOT NULL UNIQUE,
  text       text NOT NULL,
  embedding  vector(1536),
  metadata   jsonb,
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX embeddings_doc_id_idx ON embeddings (doc_id);
CREATE INDEX embeddings_embedding_idx ON embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX embeddings_metadata_type_idx ON embeddings USING gin (metadata);
CREATE INDEX embeddings_text_fts_idx ON embeddings USING gin (to_tsvector('english', text));

CREATE TABLE saved_queries (
  id                serial PRIMARY KEY,
  name              varchar(255) NOT NULL,
  question          text,
  sql_query         text NOT NULL,
  description       text,
  tags              text[],
  parameters        jsonb,
  created_by        varchar(255),
  created_at        timestamp DEFAULT CURRENT_TIMESTAMP,
  last_used_at      timestamp,
  use_count         integer DEFAULT 0,
  is_public         boolean DEFAULT false,
  shared_with_users text[],
  shared_with_teams text[],
  permissions       jsonb DEFAULT '{"edit": false, "view": true, "execute": true}'::jsonb
);

CREATE INDEX saved_queries_created_by_idx ON saved_queries (created_by);
CREATE INDEX saved_queries_is_public_idx ON saved_queries (is_public);
CREATE INDEX saved_queries_tags_idx ON saved_queries USING gin (tags);

CREATE TABLE query_cache (
  cache_key    varchar(64) PRIMARY KEY,
  question     text NOT NULL,
  sql_query    text NOT NULL,
  result_data  jsonb NOT NULL,
  result_count integer NOT NULL,
  answer       text,
  created_at   timestamp DEFAULT CURRENT_TIMESTAMP,
  expires_at   timestamp NOT NULL
);

CREATE INDEX query_cache_expires_at_idx ON query_cache (expires_at);

CREATE TABLE query_metrics (
  id               serial PRIMARY KEY,
  question         text NOT NULL,
  sql_query        text,
  success          boolean NOT NULL,
  error_message    text,
  response_time_ms integer,
  result_count     integer,
  retry_count      integer DEFAULT 0,
  cached           boolean DEFAULT false,
  created_at       timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX query_metrics_created_at_idx ON query_metrics (created_at);
CREATE INDEX query_metrics_success_idx ON query_metrics (success);

CREATE TABLE learning_signals (
  id           serial PRIMARY KEY,
  query_id     integer REFERENCES query_metrics(id) ON DELETE CASCADE,
  signal_type  varchar(50) NOT NULL,
  signal_value numeric NOT NULL,
  metadata     jsonb,
  created_at   timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX learning_signals_query_id_idx ON learning_signals (query_id);
CREATE INDEX learning_signals_type_idx ON learning_signals (signal_type);

CREATE TABLE query_refinements (
  id                 serial PRIMARY KEY,
  original_query_id  integer REFERENCES query_metrics(id) ON DELETE CASCADE,
  refined_query_id   integer REFERENCES query_metrics(id) ON DELETE CASCADE,
  refinement_type    varchar(50) NOT NULL,
  time_delta_seconds integer,
  created_at         timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX query_refinements_original_idx ON query_refinements (original_query_id);

CREATE TABLE query_quality_scores (
  id               serial PRIMARY KEY,
  question_hash    varchar(64) NOT NULL,
  sql_hash         varchar(64) NOT NULL,
  quality_score    numeric DEFAULT 0.5,
  positive_signals integer DEFAULT 0,
  negative_signals integer DEFAULT 0,
  last_updated     timestamp DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (question_hash, sql_hash)
);

CREATE INDEX query_quality_scores_score_idx ON query_quality_scores (quality_score DESC);

CREATE TABLE example_metadata (
  id                   serial PRIMARY KEY,
  question_hash        varchar(64) NOT NULL,
  sql_hash             varchar(64) NOT NULL,
  question             text,
  sql_query            text,
  category             varchar(50),
  tags                 text[],
  description          text,
  manual_quality_score numeric,
  enabled              boolean DEFAULT true,
  priority             integer DEFAULT 0,
  created_by           varchar(100),
  created_at           timestamp DEFAULT CURRENT_TIMESTAMP,
  updated_at           timestamp DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (question_hash, sql_hash)
);

CREATE TABLE example_usage (
  id                  serial PRIMARY KEY,
  example_metadata_id integer REFERENCES example_metadata(id) ON DELETE CASCADE,
  query_id            integer REFERENCES query_metrics(id) ON DELETE CASCADE,
  used_in_prompt      boolean DEFAULT false,
  query_success       boolean,
  created_at          timestamp DEFAULT CURRENT_TIMESTAMP
);

--
-- Dashboard DB schema snapshot. Source of truth for a fresh install:
--   createdb dashboard && psql dashboard < schema.sql
-- Regenerate after schema changes with:
--   pg_dump --schema-only --no-owner --no-privileges dashboard > schema.sql
--
--
-- PostgreSQL database dump
--

\restrict EHAuhhHkH3cEZKdt8macjjcEdACLCEAbrViVsQsIDPHaU1HXgUXIgYDm8TySXOc

-- Dumped from database version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: conversation_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_history (
    id integer NOT NULL,
    question text NOT NULL,
    sql_query text,
    answer text,
    result_count integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: conversation_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.conversation_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conversation_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.conversation_history_id_seq OWNED BY public.conversation_history.id;


--
-- Name: dashboard_layouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_layouts (
    user_id bigint NOT NULL,
    screen text NOT NULL,
    layout jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: embeddings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.embeddings (
    id integer NOT NULL,
    doc_id character varying(255) NOT NULL,
    text text NOT NULL,
    embedding public.vector(1536),
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: embeddings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.embeddings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: embeddings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.embeddings_id_seq OWNED BY public.embeddings.id;


--
-- Name: example_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.example_metadata (
    id integer NOT NULL,
    question_hash character varying(64) NOT NULL,
    sql_hash character varying(64) NOT NULL,
    question text,
    sql_query text,
    category character varying(50),
    tags text[],
    description text,
    manual_quality_score numeric,
    enabled boolean DEFAULT true,
    priority integer DEFAULT 0,
    created_by character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: example_metadata_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.example_metadata_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: example_metadata_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.example_metadata_id_seq OWNED BY public.example_metadata.id;


--
-- Name: example_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.example_usage (
    id integer NOT NULL,
    example_metadata_id integer,
    query_id integer,
    used_in_prompt boolean DEFAULT false,
    query_success boolean,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: example_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.example_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: example_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.example_usage_id_seq OWNED BY public.example_usage.id;


--
-- Name: invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invites (
    id bigint NOT NULL,
    token text NOT NULL,
    email text,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone
);


--
-- Name: invites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invites_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invites_id_seq OWNED BY public.invites.id;


--
-- Name: learning_signals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_signals (
    id integer NOT NULL,
    query_id integer,
    signal_type character varying(50) NOT NULL,
    signal_value numeric NOT NULL,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: learning_signals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.learning_signals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: learning_signals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.learning_signals_id_seq OWNED BY public.learning_signals.id;


--
-- Name: metric_samples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metric_samples (
    app_slug text NOT NULL,
    metric text NOT NULL,
    value double precision NOT NULL,
    taken_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: query_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.query_cache (
    cache_key character varying(64) NOT NULL,
    question text NOT NULL,
    sql_query text NOT NULL,
    result_data jsonb NOT NULL,
    result_count integer NOT NULL,
    answer text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone NOT NULL
);


--
-- Name: query_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.query_metrics (
    id integer NOT NULL,
    question text NOT NULL,
    sql_query text,
    success boolean NOT NULL,
    error_message text,
    response_time_ms integer,
    result_count integer,
    retry_count integer DEFAULT 0,
    cached boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: query_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.query_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: query_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.query_metrics_id_seq OWNED BY public.query_metrics.id;


--
-- Name: query_quality_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.query_quality_scores (
    id integer NOT NULL,
    question_hash character varying(64) NOT NULL,
    sql_hash character varying(64) NOT NULL,
    quality_score numeric DEFAULT 0.5,
    positive_signals integer DEFAULT 0,
    negative_signals integer DEFAULT 0,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: query_quality_scores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.query_quality_scores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: query_quality_scores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.query_quality_scores_id_seq OWNED BY public.query_quality_scores.id;


--
-- Name: query_refinements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.query_refinements (
    id integer NOT NULL,
    original_query_id integer,
    refined_query_id integer,
    refinement_type character varying(50) NOT NULL,
    time_delta_seconds integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: query_refinements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.query_refinements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: query_refinements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.query_refinements_id_seq OWNED BY public.query_refinements.id;


--
-- Name: saved_queries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_queries (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    question text,
    sql_query text NOT NULL,
    description text,
    tags text[],
    parameters jsonb,
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    last_used_at timestamp without time zone,
    use_count integer DEFAULT 0,
    is_public boolean DEFAULT false,
    shared_with_users text[],
    shared_with_teams text[],
    permissions jsonb DEFAULT '{"edit": false, "view": true, "execute": true}'::jsonb
);


--
-- Name: saved_queries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.saved_queries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: saved_queries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.saved_queries_id_seq OWNED BY public.saved_queries.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    filename text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid NOT NULL,
    user_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    user_agent text
);


--
-- Name: sql_widgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sql_widgets (
    id bigint NOT NULL,
    name text NOT NULL,
    description text,
    data_source text NOT NULL,
    sql text NOT NULL,
    viz text NOT NULL,
    options jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sql_widgets_viz_check CHECK ((viz = ANY (ARRAY['number'::text, 'line'::text, 'bar'::text, 'table'::text])))
);


--
-- Name: sql_widgets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sql_widgets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sql_widgets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sql_widgets_id_seq OWNED BY public.sql_widgets.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_admin boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_login_at timestamp with time zone
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: conversation_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_history ALTER COLUMN id SET DEFAULT nextval('public.conversation_history_id_seq'::regclass);


--
-- Name: embeddings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embeddings ALTER COLUMN id SET DEFAULT nextval('public.embeddings_id_seq'::regclass);


--
-- Name: example_metadata id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.example_metadata ALTER COLUMN id SET DEFAULT nextval('public.example_metadata_id_seq'::regclass);


--
-- Name: example_usage id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.example_usage ALTER COLUMN id SET DEFAULT nextval('public.example_usage_id_seq'::regclass);


--
-- Name: invites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites ALTER COLUMN id SET DEFAULT nextval('public.invites_id_seq'::regclass);


--
-- Name: learning_signals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_signals ALTER COLUMN id SET DEFAULT nextval('public.learning_signals_id_seq'::regclass);


--
-- Name: query_metrics id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.query_metrics ALTER COLUMN id SET DEFAULT nextval('public.query_metrics_id_seq'::regclass);


--
-- Name: query_quality_scores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.query_quality_scores ALTER COLUMN id SET DEFAULT nextval('public.query_quality_scores_id_seq'::regclass);


--
-- Name: query_refinements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.query_refinements ALTER COLUMN id SET DEFAULT nextval('public.query_refinements_id_seq'::regclass);


--
-- Name: saved_queries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_queries ALTER COLUMN id SET DEFAULT nextval('public.saved_queries_id_seq'::regclass);


--
-- Name: sql_widgets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sql_widgets ALTER COLUMN id SET DEFAULT nextval('public.sql_widgets_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: conversation_history conversation_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_history
    ADD CONSTRAINT conversation_history_pkey PRIMARY KEY (id);


--
-- Name: dashboard_layouts dashboard_layouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_layouts
    ADD CONSTRAINT dashboard_layouts_pkey PRIMARY KEY (user_id, screen);


--
-- Name: embeddings embeddings_doc_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embeddings
    ADD CONSTRAINT embeddings_doc_id_key UNIQUE (doc_id);


--
-- Name: embeddings embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.embeddings
    ADD CONSTRAINT embeddings_pkey PRIMARY KEY (id);


--
-- Name: example_metadata example_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.example_metadata
    ADD CONSTRAINT example_metadata_pkey PRIMARY KEY (id);


--
-- Name: example_metadata example_metadata_question_hash_sql_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.example_metadata
    ADD CONSTRAINT example_metadata_question_hash_sql_hash_key UNIQUE (question_hash, sql_hash);


--
-- Name: example_usage example_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.example_usage
    ADD CONSTRAINT example_usage_pkey PRIMARY KEY (id);


--
-- Name: invites invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_pkey PRIMARY KEY (id);


--
-- Name: invites invites_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_token_key UNIQUE (token);


--
-- Name: learning_signals learning_signals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_signals
    ADD CONSTRAINT learning_signals_pkey PRIMARY KEY (id);


--
-- Name: query_cache query_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.query_cache
    ADD CONSTRAINT query_cache_pkey PRIMARY KEY (cache_key);


--
-- Name: query_metrics query_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.query_metrics
    ADD CONSTRAINT query_metrics_pkey PRIMARY KEY (id);


--
-- Name: query_quality_scores query_quality_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.query_quality_scores
    ADD CONSTRAINT query_quality_scores_pkey PRIMARY KEY (id);


--
-- Name: query_quality_scores query_quality_scores_question_hash_sql_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.query_quality_scores
    ADD CONSTRAINT query_quality_scores_question_hash_sql_hash_key UNIQUE (question_hash, sql_hash);


--
-- Name: query_refinements query_refinements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.query_refinements
    ADD CONSTRAINT query_refinements_pkey PRIMARY KEY (id);


--
-- Name: saved_queries saved_queries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_queries
    ADD CONSTRAINT saved_queries_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (filename);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sql_widgets sql_widgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sql_widgets
    ADD CONSTRAINT sql_widgets_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: conversation_history_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_history_created_at_idx ON public.conversation_history USING btree (created_at DESC);


--
-- Name: embeddings_doc_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX embeddings_doc_id_idx ON public.embeddings USING btree (doc_id);


--
-- Name: embeddings_embedding_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX embeddings_embedding_idx ON public.embeddings USING hnsw (embedding public.vector_cosine_ops);


--
-- Name: embeddings_metadata_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX embeddings_metadata_type_idx ON public.embeddings USING gin (metadata);


--
-- Name: embeddings_text_fts_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX embeddings_text_fts_idx ON public.embeddings USING gin (to_tsvector('english'::regconfig, text));


--
-- Name: idx_samples_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_samples_lookup ON public.metric_samples USING btree (app_slug, metric, taken_at DESC);


--
-- Name: idx_sessions_exp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_exp ON public.sessions USING btree (expires_at);


--
-- Name: idx_sessions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sessions_user ON public.sessions USING btree (user_id);


--
-- Name: idx_sql_widgets_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sql_widgets_source ON public.sql_widgets USING btree (data_source);


--
-- Name: learning_signals_query_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learning_signals_query_id_idx ON public.learning_signals USING btree (query_id);


--
-- Name: learning_signals_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX learning_signals_type_idx ON public.learning_signals USING btree (signal_type);


--
-- Name: query_cache_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX query_cache_expires_at_idx ON public.query_cache USING btree (expires_at);


--
-- Name: query_metrics_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX query_metrics_created_at_idx ON public.query_metrics USING btree (created_at);


--
-- Name: query_metrics_success_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX query_metrics_success_idx ON public.query_metrics USING btree (success);


--
-- Name: query_quality_scores_score_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX query_quality_scores_score_idx ON public.query_quality_scores USING btree (quality_score DESC);


--
-- Name: query_refinements_original_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX query_refinements_original_idx ON public.query_refinements USING btree (original_query_id);


--
-- Name: saved_queries_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX saved_queries_created_by_idx ON public.saved_queries USING btree (created_by);


--
-- Name: saved_queries_is_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX saved_queries_is_public_idx ON public.saved_queries USING btree (is_public);


--
-- Name: saved_queries_tags_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX saved_queries_tags_idx ON public.saved_queries USING gin (tags);


--
-- Name: dashboard_layouts dashboard_layouts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_layouts
    ADD CONSTRAINT dashboard_layouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: example_usage example_usage_example_metadata_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.example_usage
    ADD CONSTRAINT example_usage_example_metadata_id_fkey FOREIGN KEY (example_metadata_id) REFERENCES public.example_metadata(id) ON DELETE CASCADE;


--
-- Name: example_usage example_usage_query_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.example_usage
    ADD CONSTRAINT example_usage_query_id_fkey FOREIGN KEY (query_id) REFERENCES public.query_metrics(id) ON DELETE CASCADE;


--
-- Name: invites invites_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: learning_signals learning_signals_query_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_signals
    ADD CONSTRAINT learning_signals_query_id_fkey FOREIGN KEY (query_id) REFERENCES public.query_metrics(id) ON DELETE CASCADE;


--
-- Name: query_refinements query_refinements_original_query_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.query_refinements
    ADD CONSTRAINT query_refinements_original_query_id_fkey FOREIGN KEY (original_query_id) REFERENCES public.query_metrics(id) ON DELETE CASCADE;


--
-- Name: query_refinements query_refinements_refined_query_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.query_refinements
    ADD CONSTRAINT query_refinements_refined_query_id_fkey FOREIGN KEY (refined_query_id) REFERENCES public.query_metrics(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sql_widgets sql_widgets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sql_widgets
    ADD CONSTRAINT sql_widgets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict EHAuhhHkH3cEZKdt8macjjcEdACLCEAbrViVsQsIDPHaU1HXgUXIgYDm8TySXOc


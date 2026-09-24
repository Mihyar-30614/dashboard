const BASE =
  ((import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_LLM_API_URL as string | undefined) ?? "/api/seer";

export class LlmApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Human-readable message from a failed response body (FastAPI `detail`,
 * Seer `error`, or the proxy's `error`), falling back to the raw text. */
export function errorMessage(parsed: unknown, text: string, statusText: string): string {
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    if (typeof o.detail === "string" && o.detail) return o.detail;
    if (typeof o.error === "string" && o.error) return o.error;
  }
  return text || statusText;
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
  /** Seer answers some failures (HTTP 4xx/5xx) with the endpoint's normal
   * body plus an error. When this accepts the body, it is returned instead
   * of throwing, so callers keep the explanation, SQL, and query_id. */
  failureBody?: (parsed: unknown) => boolean,
): Promise<T> {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let parsed: unknown = undefined;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }
    if (parsed !== undefined && failureBody?.(parsed)) return parsed as T;
    throw new LlmApiError(res.status, errorMessage(parsed, text, res.statusText));
  }
  return res.json();
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** A failed /query still returns a QueryResult with `error` set. */
export const isQueryFailureBody = (b: unknown): boolean =>
  isObject(b) && typeof b.error === "string" && "answer" in b;

/** A failed saved-query run still returns `{ result: { error, ... } }`. */
export const isSavedQueryFailureBody = (b: unknown): boolean =>
  isObject(b) && isObject(b.result) && typeof b.result.error === "string";

const db = (name: string) => `/api/databases/${encodeURIComponent(name)}`;

function buildQuery(
  opts?: Record<string, string | number | boolean | string[] | undefined>,
): string {
  if (!opts) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(opts)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      for (const item of v) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`);
    } else {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

export type Row = Record<string, unknown>;

export type SchemaInfo = {
  db_name: string;
  tables: string[];
  schemas: Record<
    string,
    Array<{ name: string; type: string; nullable?: boolean }>
  >;
};

export type SavedQuery = {
  id: number;
  name: string;
  question?: string | null;
  sql_query: string;
  description?: string | null;
  tags?: string[] | null;
  parameters?: Record<string, unknown> | null;
  is_public?: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
};

export type SavedQueryRequest = {
  name: string;
  sql_query: string;
  question?: string | null;
  description?: string | null;
  tags?: string[] | null;
  parameters?: Record<string, unknown> | null;
  is_public?: boolean;
  shared_with_users?: string[] | null;
  shared_with_teams?: string[] | null;
};

export type SavedQueryUpdateRequest = Partial<
  Pick<SavedQueryRequest, "name" | "description" | "tags" | "sql_query" | "parameters">
>;

export type QueryResult = {
  question: string;
  sql?: string | null;
  answer: string;
  data: Row[];
  count: number;
  error?: string | null;
  /** Stable failure kind when `error` is set (e.g. "sql_rejected", "query_timeout"). */
  error_code?: string | null;
  validation_warnings?: string[] | null;
  related_questions?: string[] | null;
  query_id?: number | null;
  /** Limitations of this answer (rows cut off, retries, cached, fallbacks). */
  caveats?: string[] | null;
};

export type TraceStage = {
  stage: string;
  ms?: number;
  error_code?: string;
  top_k?: number;
  rows?: number;
  truncated?: boolean;
  candidates?: Array<{
    table?: string;
    id?: string;
    score?: number | null;
    semantic?: number | null;
    keyword?: number | null;
  }>;
  [k: string]: unknown;
};

/** How Seer answered one question (GET .../queries/{id}/trace). Holds no
 * question, SQL, or row text. */
export type QueryTrace = {
  version?: number;
  total_ms?: number;
  stages?: TraceStage[];
  tokens?: Record<string, { calls: number; prompt: number; completion: number }>;
  fallbacks?: string[];
  attempts?: string[];
  path?: string;
  cache?: string;
  retrieval_query?: string;
  tables_kept?: string[];
  tables_allowed?: string[];
  examples_used?: string[];
  examples_dropped?: Record<string, number>;
  error_code?: string | null;
  rows?: number;
  truncated?: boolean;
  retry_count?: number;
  versions?: { model?: string | null; prompts?: string; embedding_generation?: number | null };
  [k: string]: unknown;
};

export type DiscoverQuestion = {
  question: string;
  category?: string | null;
  source?: string | null;
  quality_score?: number | null;
  priority?: number | null;
  frequency?: number | null;
  last_used?: string | null;
  avg_response_time_ms?: number | null;
};

/** One of the caller's conversation threads (GET .../conversations). */
export type ConversationThread = {
  conversation_id: string;
  title: string;
  turns: number;
  started_at: string | null;
  last_at: string | null;
};

export type ConversationTurn = {
  role?: string;
  question?: string;
  answer?: string;
  sql?: string;
  timestamp?: string;
  [k: string]: unknown;
};

export const llm = {
  baseUrl: BASE,

  listDatabases: () =>
    req<{ databases: string[]; count: number }>("GET", "/api/databases"),

  query: (
    db_name: string,
    question: string,
    use_context: boolean,
    signal?: AbortSignal,
    conversation_id?: string,
  ) =>
    req<QueryResult>(
      "POST",
      `${db(db_name)}/query`,
      { question, use_context, ...(conversation_id ? { conversation_id } : {}) },
      signal,
      isQueryFailureBody,
    ),

  listConversations: (db_name: string) =>
    req<{ db_name: string; conversations: ConversationThread[]; count: number }>(
      "GET",
      `${db(db_name)}/conversations`,
    ),

  /** Full result of an answered question as CSV, re-run on Seer (every row,
   * values whole). Refused with an error when over Seer's export limit. */
  exportCsv: async (
    db_name: string,
    query_id: number,
  ): Promise<{ blob: Blob; rowCount: number | null }> => {
    const res = await fetch(`${BASE}${db(db_name)}/queries/${query_id}/export.csv`, {
      credentials: "same-origin",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      let parsed: unknown = undefined;
      try {
        parsed = text ? JSON.parse(text) : undefined;
      } catch {
        parsed = undefined;
      }
      throw new LlmApiError(res.status, errorMessage(parsed, text, res.statusText));
    }
    const count = res.headers.get("x-seer-row-count");
    return { blob: await res.blob(), rowCount: count == null ? null : Number(count) };
  },

  queryTrace: (db_name: string, query_id: number) =>
    req<{ db_name: string; query_id: number; trace: QueryTrace }>(
      "GET",
      `${db(db_name)}/queries/${query_id}/trace`,
    ),

  getConversation: (db_name: string, conversation_id?: string) =>
    req<{ db_name: string; history: ConversationTurn[]; count: number }>(
      "GET",
      `${db(db_name)}/conversation${buildQuery({ conversation_id })}`,
    ),

  /** Clears one thread, or every thread of the caller when no id is given. */
  clearConversation: (db_name: string, conversation_id?: string) =>
    req<{ db_name: string; message: string }>(
      "DELETE",
      `${db(db_name)}/conversation${buildQuery({ conversation_id })}`,
    ),

  discover: (db_name: string, limit = 8) =>
    req<{
      category: string | null;
      questions: DiscoverQuestion[];
      count: number;
    }>("GET", `${db(db_name)}/discover?limit=${limit}`),

  feedback: (
    db_name: string,
    query_id: number,
    correct: boolean,
    note?: string,
  ) =>
    req<{
      db_name: string;
      query_id: number;
      recorded: boolean;
      correct: boolean;
      example_disabled: boolean;
      error?: string | null;
    }>("POST", `${db(db_name)}/learning/feedback`, {
      query_id,
      correct,
      note,
    }),

  schema: (db_name: string) =>
    req<SchemaInfo>("GET", `${db(db_name)}/schema`),

  tableSchema: (db_name: string, table: string) =>
    req<{ db_name: string; table_name: string; schema: unknown }>(
      "GET",
      `${db(db_name)}/schema/${encodeURIComponent(table)}`,
    ),

  savedQueries: {
    list: (
      db_name: string,
      opts?: { search_term?: string; tags?: string[]; limit?: number; offset?: number },
    ) =>
      req<{ db_name: string; queries: SavedQuery[]; count: number }>(
        "GET",
        `${db(db_name)}/saved-queries${buildQuery(opts)}`,
      ),
    get: (db_name: string, id: number) =>
      req<{ db_name: string; query: SavedQuery }>(
        "GET",
        `${db(db_name)}/saved-queries/${id}`,
      ),
    create: (db_name: string, body: SavedQueryRequest) =>
      req<{ db_name: string; query_id: number; message: string }>(
        "POST",
        `${db(db_name)}/saved-queries`,
        body,
      ),
    update: (db_name: string, id: number, body: SavedQueryUpdateRequest) =>
      req<{ db_name: string; query_id: number; message: string }>(
        "PUT",
        `${db(db_name)}/saved-queries/${id}`,
        body,
      ),
    delete: (db_name: string, id: number) =>
      req<{ db_name: string; query_id: number; message: string }>(
        "DELETE",
        `${db(db_name)}/saved-queries/${id}`,
      ),
    execute: (
      db_name: string,
      id: number,
      parameters?: Record<string, unknown>,
    ) =>
      req<{
        db_name: string;
        query_id: number;
        result: {
          data: Row[];
          count: number;
          error: string | null;
          error_code?: string | null;
        };
      }>(
        "POST",
        `${db(db_name)}/saved-queries/${id}/execute`,
        { parameters: parameters ?? {} },
        undefined,
        isSavedQueryFailureBody,
      ),
  },
};

const BASE =
  ((import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_LLM_API_URL as string | undefined) ?? "/api/seer";

export class LlmApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
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
    throw new LlmApiError(res.status, text || res.statusText);
  }
  return res.json();
}

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
  validation_warnings?: string[] | null;
  related_questions?: string[] | null;
  query_id?: number | null;
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
  ) =>
    req<QueryResult>(
      "POST",
      `${db(db_name)}/query`,
      { question, use_context },
      signal,
    ),

  getConversation: (db_name: string) =>
    req<{ db_name: string; history: ConversationTurn[]; count: number }>(
      "GET",
      `${db(db_name)}/conversation`,
    ),

  clearConversation: (db_name: string) =>
    req<{ db_name: string; message: string }>(
      "DELETE",
      `${db(db_name)}/conversation`,
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
        result: { data: Row[]; count: number; error: string | null };
      }>(
        "POST",
        `${db(db_name)}/saved-queries/${id}/execute`,
        { parameters: parameters ?? {} },
      ),
  },
};

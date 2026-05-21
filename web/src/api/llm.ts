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

export type Row = Record<string, unknown>;

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
    req<{ category: string | null; questions: string[]; count: number }>(
      "GET",
      `${db(db_name)}/discover?limit=${limit}`,
    ),

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
};

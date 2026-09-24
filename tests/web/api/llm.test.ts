import { afterEach, describe, expect, it, vi } from "vitest";
import { LlmApiError, llm } from "@/api/llm";

function respond(status: number, body: unknown) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(text, { status, headers: { "content-type": "application/json" } })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("seer client error contract", () => {
  it("returns the query body for a failed question so the UI keeps sql and query_id", async () => {
    respond(400, {
      question: "Delete all orders",
      sql: "DELETE FROM orders",
      answer: "I can only run read-only queries.",
      data: [],
      count: 0,
      error: "Only SELECT queries are allowed",
      error_code: "sql_rejected",
      query_id: 41,
    });
    const r = await llm.query("sportly", "Delete all orders", false);
    expect(r.error).toBe("Only SELECT queries are allowed");
    expect(r.error_code).toBe("sql_rejected");
    expect(r.sql).toBe("DELETE FROM orders");
    expect(r.query_id).toBe(41);
  });

  it("returns the saved-query body for a failed run", async () => {
    respond(504, {
      db_name: "sportly",
      query_id: 3,
      result: { data: [], count: 0, error: "Query exceeded the 30s timeout", error_code: "query_timeout" },
    });
    const r = await llm.savedQueries.execute("sportly", 3);
    expect(r.result.error).toBe("Query exceeded the 30s timeout");
    expect(r.result.error_code).toBe("query_timeout");
  });

  it("throws with the server's detail message, not raw JSON", async () => {
    respond(403, { detail: "API key not allowed for this database" });
    const err = await llm.query("secret", "q", false).catch((e) => e);
    expect(err).toBeInstanceOf(LlmApiError);
    expect(err.status).toBe(403);
    expect(err.message).toBe("API key not allowed for this database");
  });

  it("throws on failures whose body is not a query result", async () => {
    respond(502, { error: "seer_upstream_unreachable", detail: "connect ECONNREFUSED" });
    const err = await llm.query("sportly", "q", false).catch((e) => e);
    expect(err).toBeInstanceOf(LlmApiError);
    expect(err.status).toBe(502);
    expect(err.message).toBe("connect ECONNREFUSED");
  });

  it("falls back to the raw text for non-JSON errors", async () => {
    respond(500, "Internal Server Error");
    const err = await llm.listDatabases().catch((e) => e);
    expect(err.message).toBe("Internal Server Error");
  });
});

describe("seer client caveats", () => {
  it("passes answer caveats through", async () => {
    respond(200, {
      question: "q", sql: "SELECT 1", answer: "a", data: [], count: 0,
      caveats: ["Served from the answer cache; the data may have changed since."],
    });
    const r = await llm.query("sportly", "q", false);
    expect(r.caveats).toEqual(["Served from the answer cache; the data may have changed since."]);
  });
});

describe("seer client csv export", () => {
  it("downloads the full result with its row count", async () => {
    const fetchMock = vi.fn(async () => new Response("id\r\n1\r\n", {
      status: 200,
      headers: { "content-type": "text/csv; charset=utf-8", "x-seer-row-count": "1" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { blob, rowCount } = await llm.exportCsv("sportly", 7);
    expect(blob.size).toBe("id\r\n1\r\n".length);
    expect(rowCount).toBe(1);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/databases\/sportly\/queries\/7\/export\.csv$/);
  });

  it("reports why an export was refused", async () => {
    respond(400, { detail: "This result has 900,000 rows; exports are limited to 200,000." });
    const err = await llm.exportCsv("sportly", 7).catch((e) => e);
    expect(err).toBeInstanceOf(LlmApiError);
    expect(err.message).toMatch(/900,000 rows/);
  });
});

describe("seer client conversation threads", () => {
  it("sends the thread with a question and scopes reads and clears to it", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ question: "q", answer: "a", data: [], count: 0, history: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await llm.query("sportly", "q", true, undefined, "tab-1");
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toMatchObject({ conversation_id: "tab-1" });
    await llm.getConversation("sportly", "tab-1");
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/conversation\?conversation_id=tab-1$/);
    await llm.clearConversation("sportly", "tab-1");
    expect(String(fetchMock.mock.calls[2][0])).toMatch(/\/conversation\?conversation_id=tab-1$/);
    await llm.query("sportly", "q", true);
    expect(JSON.parse(String((fetchMock.mock.calls[3][1] as RequestInit).body))).not.toHaveProperty("conversation_id");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EvidenceView from "@/analytics/result/EvidenceView";
import { LlmApiError, llm, type QueryTrace } from "@/api/llm";

function renderView(queryId: number | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <EvidenceView dbName="sportly" queryId={queryId} />
    </QueryClientProvider>,
  );
}

const TRACE: QueryTrace = {
  total_ms: 2140,
  path: "single_step",
  cache: "miss",
  retrieval_query: "rewritten",
  attempts: ["sql_rejected", "ok"],
  rows: 12,
  truncated: false,
  fallbacks: ["rerank_table_failed"],
  tables_kept: ["events"],
  tables_allowed: ["events", "users"],
  examples_used: ["query_ab12"],
  examples_dropped: { low_quality: 2 },
  stages: [
    {
      stage: "search_tables",
      ms: 40,
      top_k: 8,
      candidates: [
        { table: "events", score: 0.8123, semantic: 0.9, keyword: 0.6 },
        { table: "users", score: 0.41, semantic: 0.5, keyword: 0 },
      ],
    },
    { stage: "execute", ms: 12, rows: 12, truncated: false },
  ],
  tokens: { sql: { calls: 2, prompt: 3000, completion: 120 } },
  versions: { model: "gpt-5.4", prompts: "abc123", embedding_generation: 1 },
};

afterEach(() => vi.restoreAllMocks());

describe("EvidenceView", () => {
  it("shows how the answer was produced", async () => {
    const spy = vi.spyOn(llm, "queryTrace").mockResolvedValue({ db_name: "sportly", query_id: 7, trace: TRACE });
    renderView(7);

    expect(await screen.findByText("Summary")).toBeTruthy();
    expect(spy).toHaveBeenCalledWith("sportly", 7);
    expect(screen.getByText("1. rejected by validator · 2. ran")).toBeTruthy();
    expect(screen.getByText(/restated as a standalone question/)).toBeTruthy();
    expect(screen.getByText("table ranking unavailable (used search order)")).toBeTruthy();
    expect(screen.getByText("0.812")).toBeTruthy();
    expect(screen.getByText("events, users")).toBeTruthy();
    expect(screen.getByText("2 low quality")).toBeTruthy();
    expect(screen.getByText("3120 tokens")).toBeTruthy();
    expect(screen.getByText("gpt-5.4")).toBeTruthy();
  });

  it("explains a missing trace", async () => {
    vi.spyOn(llm, "queryTrace").mockRejectedValue(new LlmApiError(404, "No trace for this query"));
    renderView(7);
    expect(await screen.findByText(/predates tracing/)).toBeTruthy();
  });

  it("does not fetch without a query id", () => {
    const spy = vi.spyOn(llm, "queryTrace");
    renderView(null);
    expect(screen.getByText(/no query id/)).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
  });
});

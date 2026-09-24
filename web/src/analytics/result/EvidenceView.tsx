import { useQuery } from "@tanstack/react-query";
import { LlmApiError, llm, type QueryTrace, type TraceStage } from "../../api/llm";

const ATTEMPT_LABELS: Record<string, string> = {
  ok: "ran",
  sql_rejected: "rejected by validator",
  sql_failed: "failed in database",
  query_timeout: "timed out",
  request_deadline_exceeded: "out of time",
  model_error: "model error",
  internal_error: "internal error",
};

const FALLBACK_LABELS: Record<string, string> = {
  rerank_table_failed: "table ranking unavailable (used search order)",
  rerank_table_unparseable: "table ranking unavailable (used search order)",
  rerank_example_failed: "example ranking unavailable (used search order)",
  rerank_example_unparseable: "example ranking unavailable (used search order)",
  fuzzy_table_recovery: "unknown table name replaced by closest match",
  multi_step_failed: "multi-step planning failed (single query used)",
  multi_step_no_final_sql: "multi-step plan had no query (single query used)",
  plan_failed: "multi-step planning failed",
  answer_canned: "answer text is a generic fallback",
  follow_up_rewrite_failed: "follow-up could not be restated for search",
};

const RETRIEVAL_LABELS: Record<string, string> = {
  rewritten: "follow-up restated as a standalone question for search",
  unchanged: "follow-up already stood alone",
  rewrite_failed: "follow-up searched as asked (restating failed)",
};

function fmtScore(v: number | null | undefined): string {
  return typeof v === "number" ? v.toFixed(3) : "–";
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="an-evidence__row">
      <span className="an-evidence__label">{label}</span>
      <span>{children}</span>
    </div>
  );
}

function TableCandidates({ stage, kept }: { stage: TraceStage; kept: Set<string> }) {
  const rows = stage.candidates ?? [];
  if (rows.length === 0) return null;
  return (
    <table className="an-table an-evidence__table">
      <thead>
        <tr>
          <th>table</th>
          <th>score</th>
          <th>semantic</th>
          <th>keyword</th>
          <th>used</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c, i) => (
          <tr key={`${c.table}-${i}`}>
            <td>{c.table}</td>
            <td>{fmtScore(c.score)}</td>
            <td>{fmtScore(c.semantic)}</td>
            <td>{fmtScore(c.keyword)}</td>
            <td>{c.table && kept.has(c.table) ? "✓" : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TraceDetails({ trace }: { trace: QueryTrace }) {
  const stages = trace.stages ?? [];
  const tableSearch = [...stages].reverse().find((s) => s.stage === "search_tables");
  const kept = new Set(trace.tables_kept ?? []);
  const tokens = Object.entries(trace.tokens ?? {});
  const totalTokens = tokens.reduce((n, [, t]) => n + t.prompt + t.completion, 0);
  const dropped = Object.entries(trace.examples_dropped ?? {});

  return (
    <div className="an-evidence">
      <section>
        <h4 className="an-evidence__h">Summary</h4>
        <Row label="path">
          {trace.cache === "hit" ? "answer cache" : trace.path === "multi_step" ? "multi-step plan" : "single query"}
        </Row>
        {trace.retrieval_query && (
          <Row label="search">{RETRIEVAL_LABELS[trace.retrieval_query] ?? trace.retrieval_query}</Row>
        )}
        {trace.attempts && trace.attempts.length > 0 && (
          <Row label="SQL attempts">
            {trace.attempts.map((a, i) => `${i + 1}. ${ATTEMPT_LABELS[a] ?? a}`).join(" · ")}
          </Row>
        )}
        <Row label="rows">
          {trace.rows ?? 0}
          {trace.truncated ? " (cut off at the row limit)" : ""}
        </Row>
        {trace.error_code && <Row label="error">{trace.error_code}</Row>}
        {typeof trace.total_ms === "number" && <Row label="time">{trace.total_ms} ms</Row>}
      </section>

      {(trace.fallbacks ?? []).length > 0 && (
        <section>
          <h4 className="an-evidence__h">Fallbacks</h4>
          <ul className="an-evidence__list">
            {(trace.fallbacks ?? []).map((f, i) => (
              <li key={i}>{FALLBACK_LABELS[f] ?? f}</li>
            ))}
          </ul>
        </section>
      )}

      {(tableSearch || kept.size > 0) && (
        <section>
          <h4 className="an-evidence__h">Tables</h4>
          {tableSearch && <TableCandidates stage={tableSearch} kept={kept} />}
          {trace.tables_allowed && trace.tables_allowed.length > 0 && (
            <Row label="allowed in SQL">{trace.tables_allowed.join(", ")}</Row>
          )}
        </section>
      )}

      {(trace.examples_used || dropped.length > 0) && (
        <section>
          <h4 className="an-evidence__h">Examples</h4>
          <Row label="used in prompt">{(trace.examples_used ?? []).length}</Row>
          {dropped.length > 0 && (
            <Row label="skipped">{dropped.map(([k, n]) => `${n} ${k.replace("_", " ")}`).join(", ")}</Row>
          )}
        </section>
      )}

      {stages.length > 0 && (
        <section>
          <h4 className="an-evidence__h">Stages</h4>
          <table className="an-table an-evidence__table">
            <tbody>
              {stages.map((s, i) => (
                <tr key={i}>
                  <td>{s.stage}</td>
                  <td>{typeof s.ms === "number" ? `${s.ms} ms` : ""}</td>
                  <td>{s.error_code ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tokens.length > 0 && (
        <section>
          <h4 className="an-evidence__h">Model usage</h4>
          {tokens.map(([call, t]) => (
            <Row key={call} label={call}>
              {t.calls} call{t.calls === 1 ? "" : "s"}, {t.prompt} in / {t.completion} out
            </Row>
          ))}
          <Row label="total">{totalTokens} tokens</Row>
        </section>
      )}

      {trace.versions && (
        <section>
          <h4 className="an-evidence__h">Versions</h4>
          {trace.versions.model && <Row label="model">{trace.versions.model}</Row>}
          {trace.versions.prompts && <Row label="prompts">{trace.versions.prompts}</Row>}
          {trace.versions.embedding_generation != null && (
            <Row label="embeddings">generation {trace.versions.embedding_generation}</Row>
          )}
        </section>
      )}
    </div>
  );
}

/** How Seer produced this answer, from its stored trace. */
export default function EvidenceView({ dbName, queryId }: { dbName: string; queryId: number | null }) {
  const q = useQuery({
    queryKey: ["seer-trace", dbName, queryId],
    queryFn: () => llm.queryTrace(dbName, queryId as number),
    enabled: queryId != null && !!dbName,
    staleTime: Infinity,
    retry: false,
  });

  if (queryId == null) {
    return <div className="an-result__placeholder">No details: this answer has no query id.</div>;
  }
  if (q.isLoading) {
    return <div className="an-result__placeholder">loading details…</div>;
  }
  if (q.error) {
    const notFound = q.error instanceof LlmApiError && q.error.status === 404;
    return (
      <div className="an-result__placeholder">
        {notFound
          ? "No details recorded for this answer (it predates tracing)."
          : `Could not load details: ${(q.error as Error).message}`}
      </div>
    );
  }
  return q.data ? <TraceDetails trace={q.data.trace} /> : null;
}

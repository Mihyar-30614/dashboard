import type { QA, ResultTab } from "../types";
import type { SavedQueryRequest } from "../../api/llm";
import TableView from "./TableView";
import ChartView from "./ChartView";
import SqlView from "./SqlView";
import JsonView from "./JsonView";
import RelatedChips from "./RelatedChips";
import ResultActions from "./ResultActions";

const TABS: ResultTab[] = ["chart", "table", "sql", "json"];

export default function ResultPane({
  qa,
  pending,
  activeTab,
  onTabChange,
  onFeedback,
  onRelated,
  onSave,
  onToast,
  dbName,
}: {
  qa: QA | null;
  pending: boolean;
  activeTab: ResultTab;
  onTabChange: (t: ResultTab) => void;
  onFeedback: (correct: boolean) => void;
  onRelated: (q: string) => void;
  onSave: (body: SavedQueryRequest) => Promise<number>;
  onToast: (msg: string, kind?: "ok" | "err") => void;
  dbName: string;
}) {
  if (!qa) {
    return (
      <section className="an-result">
        <div className="an-result__placeholder">
          Pick a question from history, or ask a new one.
        </div>
      </section>
    );
  }

  if (pending) {
    return (
      <section className="an-result">
        <div className="an-result__q">
          <span className="an-result__q-label">Q</span>
          <span>{qa.question}</span>
        </div>
        <div className="an-result__a">
          <span className="an-result__a-label">A</span>
          <span style={{ color: "var(--muted)" }}>thinking…</span>
        </div>
        <div className="an-skeleton">
          <div className="an-skeleton__bar skeleton" style={{ width: "70%" }} />
          <div className="an-skeleton__bar skeleton" style={{ width: "85%" }} />
          <div className="an-skeleton__bar skeleton" style={{ width: "50%" }} />
        </div>
      </section>
    );
  }

  if (qa.error) {
    return (
      <section className="an-result">
        <div className="an-result__q">
          <span className="an-result__q-label">Q</span>
          <span>{qa.question}</span>
        </div>
        <div className="an-result__error">{qa.error}</div>
      </section>
    );
  }

  const body = (() => {
    switch (activeTab) {
      case "chart":
        return (
          <ChartView rows={qa.data} fallback={<TableView rows={qa.data} />} />
        );
      case "table":
        return <TableView rows={qa.data} />;
      case "sql":
        return <SqlView sql={qa.sql} />;
      case "json":
        return <JsonView rows={qa.data} />;
    }
  })();

  return (
    <section className="an-result">
      <div className="an-result__q">
        <span className="an-result__q-label">Q</span>
        <span>{qa.question}</span>
      </div>
      {qa.answer && (
        <div className="an-result__a">
          <span className="an-result__a-label">A</span>
          <span>{qa.answer}</span>
        </div>
      )}

      <div className="an-result__tabs">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={"an-result__tab" + (t === activeTab ? " is-active" : "")}
            onClick={() => onTabChange(t)}
          >
            {t}
          </button>
        ))}
        <div className="an-result__actions">
          <ResultActions
            qa={qa}
            activeTab={activeTab}
            dbName={dbName}
            onSave={onSave}
            onToast={onToast}
          />
        </div>
      </div>

      <div className="an-result__body">{body}</div>

      {qa.warnings && qa.warnings.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 16, color: "var(--muted)", fontSize: 12 }}>
          {qa.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      <RelatedChips related={qa.related} onPick={onRelated} />

      {qa.query_id != null && (
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => onFeedback(true)}
            style={{
              padding: "4px 8px",
              background:
                qa.feedback === "up"
                  ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                  : "transparent",
              border: "1px solid var(--rule)",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            👍
          </button>
          <button
            type="button"
            onClick={() => onFeedback(false)}
            style={{
              padding: "4px 8px",
              background:
                qa.feedback === "down"
                  ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                  : "transparent",
              border: "1px solid var(--rule)",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            👎
          </button>
        </div>
      )}
    </section>
  );
}

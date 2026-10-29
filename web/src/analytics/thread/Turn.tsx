import { RotateCw, ThumbsDown, ThumbsUp } from "lucide-react";
import type { QA, ResultTab } from "../types";
import type { SavedQueryRequest } from "../../api/llm";
import TableView from "../result/TableView";
import ChartView from "../result/ChartView";
import SqlView from "../result/SqlView";
import JsonView from "../result/JsonView";
import RelatedChips from "../result/RelatedChips";
import ResultActions from "../result/ResultActions";
import AnswerText from "../result/AnswerText";
import Caveats from "../result/Caveats";
import EvidenceView from "../result/EvidenceView";

const TABS: ResultTab[] = ["chart", "table", "sql", "json", "details"];

/** One question and its answer in the conversation thread. */
export default function Turn({
  qa,
  pending,
  activeTab,
  onTabChange,
  onFeedback,
  onRelated,
  onRerun,
  onSave,
  onToast,
  dbName,
  isLast,
}: {
  qa: QA;
  pending: boolean;
  activeTab: ResultTab;
  onTabChange: (t: ResultTab) => void;
  onFeedback: (correct: boolean) => void;
  onRelated: (q: string) => void;
  /** Runs a turn restored from an earlier session again to get its rows. */
  onRerun: () => void;
  onSave: (body: SavedQueryRequest) => Promise<number>;
  onToast: (msg: string, kind?: "ok" | "err") => void;
  dbName: string;
  /** Follow-up suggestions only show under the latest turn. */
  isLast: boolean;
}) {
  const question = <p className="an-turn__q">{qa.question}</p>;

  if (pending) {
    return (
      <article className="an-turn" aria-busy="true">
        {question}
        <p className="an-turn__status">
          <span className="led an-turn__led" /> Querying {dbName}…{" "}
          <span className="an-turn__hint">Esc to stop</span>
        </p>
        <div className="an-skeleton" aria-hidden="true">
          <div className="an-skeleton__bar skeleton" style={{ width: "70%" }} />
          <div className="an-skeleton__bar skeleton" style={{ width: "85%" }} />
          <div className="an-skeleton__bar skeleton" style={{ width: "50%" }} />
        </div>
      </article>
    );
  }

  if (qa.error) {
    return (
      <article className="an-turn">
        {question}
        <div className="an-result__error" role="alert">
          {qa.error}
        </div>
        {qa.query_id != null && (
          <details className="an-evidence__disclosure">
            <summary>details</summary>
            <EvidenceView dbName={dbName} queryId={qa.query_id} />
          </details>
        )}
      </article>
    );
  }

  const answer = qa.answer && (
    <div className="an-turn__a">
      <AnswerText text={qa.answer} />
    </div>
  );

  if (qa.restored) {
    return (
      <article className="an-turn">
        {question}
        {answer}
        <div className="an-turn__restored">
          <span>Rows from an earlier session aren't kept.</span>
          {qa.sql && (
            <button type="button" className="an-btn" onClick={onRerun}>
              <RotateCw size={13} strokeWidth={1.9} /> Run again
            </button>
          )}
        </div>
      </article>
    );
  }

  const body = (() => {
    switch (activeTab) {
      case "chart":
        return <ChartView rows={qa.data} fallback={<TableView rows={qa.data} />} />;
      case "table":
        return <TableView rows={qa.data} />;
      case "sql":
        return <SqlView sql={qa.sql} />;
      case "json":
        return <JsonView rows={qa.data} />;
      case "details":
        return <EvidenceView dbName={dbName} queryId={qa.query_id} />;
    }
  })();

  return (
    <article className="an-turn">
      {question}
      {answer}

      <div className="an-result">
        <div className="an-result__tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={t === activeTab}
              className={"an-result__tab" + (t === activeTab ? " is-active" : "")}
              onClick={() => onTabChange(t)}
            >
              {t}
            </button>
          ))}
          <span className="an-result__count">
            {qa.count.toLocaleString()} {qa.count === 1 ? "row" : "rows"}
          </span>
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
      </div>

      {qa.warnings && qa.warnings.length > 0 && (
        <ul className="an-turn__notes">
          {qa.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      <Caveats caveats={qa.caveats} />

      {qa.query_id != null && (
        <div className="an-result__feedback">
          <span className="an-result__feedback-label">Right answer?</span>
          <button
            type="button"
            onClick={() => onFeedback(true)}
            className={"an-result__fb" + (qa.feedback === "up" ? " is-active" : "")}
            title="Mark as correct"
            aria-label="Mark as correct"
            aria-pressed={qa.feedback === "up"}
          >
            <ThumbsUp size={13} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => onFeedback(false)}
            className={"an-result__fb" + (qa.feedback === "down" ? " is-active" : "")}
            title="Mark as wrong"
            aria-label="Mark as wrong"
            aria-pressed={qa.feedback === "down"}
          >
            <ThumbsDown size={13} strokeWidth={1.8} />
          </button>
        </div>
      )}

      {isLast && <RelatedChips related={qa.related} onPick={onRelated} />}
    </article>
  );
}

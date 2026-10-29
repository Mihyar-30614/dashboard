import { useEffect, useRef, type ReactNode } from "react";
import type { QA } from "../types";

/** The conversation as a scrolling column of turns, or a starting point
 * when it has none. Keeps the newest turn in view as questions are asked. */
export default function Thread({
  history,
  renderTurn,
  empty,
}: {
  history: QA[];
  renderTurn: (qa: QA, isLast: boolean) => ReactNode;
  empty: ReactNode;
}) {
  const lastRef = useRef<HTMLDivElement | null>(null);
  const lastId = history[history.length - 1]?.id;

  // Bring the newest question to the top of the view, so a tall chart
  // never pushes the question and answer out of sight.
  useEffect(() => {
    lastRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [lastId]);

  return (
    <div className="an-thread">
      {history.length === 0 ? (
        empty
      ) : (
        <>
          {history.map((qa, i) => {
            const isLast = i === history.length - 1;
            return (
              <div key={qa.id} ref={isLast ? lastRef : undefined} className="an-thread__item">
                {renderTurn(qa, isLast)}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/** First view of a conversation: what to ask, or what is missing first. */
export function ThreadStart({
  db,
  blocker,
  suggestions,
  onPick,
}: {
  db: string;
  /** Why asking is not possible yet; hides the suggestions. */
  blocker: string | null;
  suggestions: string[];
  onPick: (q: string) => void;
}) {
  return (
    <div className="an-start">
      <h3 className="an-start__title">
        Ask <em>{db || "a database"}</em> anything.
      </h3>
      <p className="an-start__lede">
        {blocker ??
          "Questions become read-only SQL. Each answer keeps its query, rows and chart so you can check the work."}
      </p>
      {!blocker && suggestions.length > 0 && (
        <div className="an-start__suggest">
          <span className="an-start__label">Try one of these</span>
          <ul>
            {suggestions.map((q) => (
              <li key={q}>
                <button type="button" onClick={() => onPick(q)}>
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

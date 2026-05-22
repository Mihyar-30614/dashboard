import type { QA } from "../types";

export default function HistoryList({
  history,
  activeId,
  onPick,
}: {
  history: QA[];
  activeId: string | null;
  onPick: (id: string) => void;
}) {
  if (history.length === 0) {
    return <div className="an-rail__empty">No questions yet.</div>;
  }
  const items = [...history].reverse();
  return (
    <>
      {items.map((qa) => (
        <button
          key={qa.id}
          type="button"
          className={
            "an-rail__item" + (qa.id === activeId ? " is-active" : "")
          }
          onClick={() => onPick(qa.id)}
          title={qa.question}
        >
          {qa.id === activeId && <span className="an-rail__dot" />}
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {qa.question}
          </span>
        </button>
      ))}
    </>
  );
}

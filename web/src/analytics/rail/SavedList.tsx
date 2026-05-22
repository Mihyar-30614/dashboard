import type { SavedQuery } from "../../api/llm";

export default function SavedList({
  saved,
  onPick,
  onDelete,
}: {
  saved: SavedQuery[];
  onPick: (q: SavedQuery) => void;
  onDelete: (id: number) => void;
}) {
  if (saved.length === 0) {
    return <div className="an-rail__empty">No saved queries.</div>;
  }
  return (
    <>
      {saved.map((q) => (
        <div
          key={q.id}
          className="an-rail__item"
          style={{ display: "flex", gap: 6 }}
        >
          <span style={{ color: "var(--accent)" }}>★</span>
          <button
            type="button"
            onClick={() => onPick(q)}
            title={q.description ?? q.name}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: "inherit",
              padding: 0,
              textAlign: "left",
              cursor: "pointer",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {q.name}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete saved query "${q.name}"?`)) onDelete(q.id);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--muted)",
              padding: "0 4px",
              cursor: "pointer",
            }}
            title="Delete"
          >
            ×
          </button>
        </div>
      ))}
    </>
  );
}

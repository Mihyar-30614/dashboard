import { useState } from "react";
import type { SavedQuery } from "../../api/llm";
import ConfirmDialog from "../../ui/ConfirmDialog";

export default function SavedList({
  saved,
  onPick,
  onDelete,
}: {
  saved: SavedQuery[];
  onPick: (q: SavedQuery) => void;
  onDelete: (id: number) => void;
}) {
  const [confirming, setConfirming] = useState<SavedQuery | null>(null);

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
              setConfirming(q);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--muted)",
              padding: "0 4px",
              cursor: "pointer",
            }}
            title="Delete saved query"
            aria-label={`Delete ${q.name}`}
          >
            ×
          </button>
        </div>
      ))}
      <ConfirmDialog
        open={confirming !== null}
        title="Delete saved query"
        message={confirming ? `Delete "${confirming.name}"? This can't be undone.` : ""}
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (confirming) onDelete(confirming.id);
          setConfirming(null);
        }}
        onCancel={() => setConfirming(null)}
      />
    </>
  );
}

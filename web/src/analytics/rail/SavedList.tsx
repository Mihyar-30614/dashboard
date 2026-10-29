import { useState } from "react";
import { Star, X } from "lucide-react";
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
        <div key={q.id} className="an-rail__item an-saved">
          <Star size={12} strokeWidth={1.8} className="an-saved__star" aria-hidden="true" />
          <button
            type="button"
            className="an-saved__run"
            onClick={() => onPick(q)}
            title={q.description ?? q.name}
          >
            {q.name}
          </button>
          <button
            type="button"
            className="an-saved__del"
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(q);
            }}
            title="Delete saved query"
            aria-label={`Delete ${q.name}`}
          >
            <X size={12} strokeWidth={2} />
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

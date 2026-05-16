type Props = {
  editing: boolean;
  dirty: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onAdd: () => void;
  saving: boolean;
};

export default function EditModeBar({
  editing,
  dirty,
  onEdit,
  onSave,
  onCancel,
  onAdd,
  saving,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        marginBottom: 20,
      }}
    >
      {!editing && (
        <button type="button" onClick={onEdit}>
          ✎ Edit layout
        </button>
      )}
      {editing && (
        <>
          <button type="button" onClick={onAdd}>
            + Add widget
          </button>
          <button onClick={onSave} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save layout"}
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          {dirty && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--warn)",
                marginLeft: 6,
              }}
            >
              <span className="led led--warn" style={{ marginRight: 8 }} />
              unsaved
            </span>
          )}
        </>
      )}
    </div>
  );
}

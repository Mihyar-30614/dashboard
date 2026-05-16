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
        marginBottom: 12,
      }}
    >
      {!editing && <button onClick={onEdit}>Edit layout</button>}
      {editing && (
        <>
          <button onClick={onAdd}>+ Add widget</button>
          <button onClick={onSave} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={onCancel}>Cancel</button>
        </>
      )}
    </div>
  );
}

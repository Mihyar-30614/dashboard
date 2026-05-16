import { WIDGETS } from "../widgets/registry";

export default function WidgetPalette({
  open,
  scope,
  onPick,
  onClose,
}: {
  open: boolean;
  scope: "app" | "overview";
  onPick: (kind: string) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  const items = Object.entries(WIDGETS).filter(
    ([, w]) => w.scope === scope || w.scope === "both",
  );
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 280,
        background: "var(--panel)",
        borderLeft: "1px solid var(--border)",
        padding: 16,
        zIndex: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <strong>Add widget</strong>
        <button onClick={onClose}>×</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map(([kind, def]) => (
          <button
            key={kind}
            onClick={() => {
              onPick(kind);
              onClose();
            }}
            style={{
              textAlign: "left",
              padding: 10,
              border: "1px solid var(--border)",
              borderRadius: 6,
              background: "transparent",
              color: "var(--text)",
            }}
          >
            <div>
              <strong>{def.label}</strong>
            </div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>
              kind: {kind}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

import { X } from "lucide-react";
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
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "color-mix(in srgb, var(--ink) 30%, transparent)",
          zIndex: 19,
          animation: "fadeUp 200ms ease-out both",
        }}
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 340,
          background: "var(--panel)",
          borderLeft: "1px solid var(--rule)",
          padding: 24,
          zIndex: 20,
          overflowY: "auto",
          boxShadow: "-24px 0 60px -24px rgba(0,0,0,0.25)",
          animation: "fadeUp 240ms ease-out both",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <div>
            <div className="eyebrow">palette · {scope}</div>
            <h3 style={{ marginTop: 4, marginBottom: 0 }}>Add widget</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close palette"
            title="Close"
            style={{
              width: 30,
              height: 30,
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map(([kind, def]) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                onPick(kind);
                onClose();
              }}
              style={{
                textAlign: "left",
                padding: "12px 14px",
                background: "transparent",
                color: "var(--text)",
                borderColor: "var(--border)",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14 }}>{def.label}</div>
              <div
                style={{
                  marginTop: 4,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                }}
              >
                {kind} · {def.defaultSize.w}×{def.defaultSize.h}
              </div>
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}

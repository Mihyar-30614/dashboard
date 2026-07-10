import { X } from "lucide-react";
import { WIDGETS } from "../widgets/registry";

export type DynamicPaletteItem = {
  key: string;
  label: string;
  description: string;
  defaultSize: { w: number; h: number };
  scope: "app" | "overview";
  appSlug?: string;
  onPick: () => void;
};

export default function WidgetPalette({
  open,
  scope,
  appSlug,
  dynamic = [],
  onPick,
  onClose,
}: {
  open: boolean;
  scope: "app" | "overview";
  appSlug?: string;
  dynamic?: DynamicPaletteItem[];
  onPick: (kind: string) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  const staticItems = Object.entries(WIDGETS).filter(
    ([kind, w]) => kind !== "sql" && (w.scope === scope || w.scope === "both"),
  );

  const dynamicItems = dynamic.filter(d =>
    d.scope === scope &&
    (scope === "overview" || d.appSlug === appSlug)
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
          borderLeft: "1px solid var(--border)",
          padding: 24,
          zIndex: 20,
          overflowY: "auto",
          boxShadow: "var(--shadow-md)",
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
          {staticItems.map(([kind, def]) => (
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
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 14 }}>{def.label}</span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    color: "var(--muted)",
                    flexShrink: 0,
                  }}
                >
                  {def.defaultSize.w}×{def.defaultSize.h}
                </span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: "var(--muted)",
                  fontWeight: 400,
                  whiteSpace: "normal",
                }}
              >
                {def.description}
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  opacity: 0.7,
                }}
              >
                {kind}
              </div>
            </button>
          ))}
          {dynamicItems.length > 0 && (
            <>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 10,
                letterSpacing: "0.14em", textTransform: "uppercase",
                color: "var(--muted)", padding: "8px 2px 2px",
              }}>
                custom sql
              </div>
              {dynamicItems.map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    item.onPick();
                    onClose();
                  }}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    background: "transparent",
                    color: "var(--text)",
                    borderColor: "var(--border)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        letterSpacing: "0.14em",
                        color: "var(--muted)",
                        flexShrink: 0,
                      }}
                    >
                      {item.defaultSize.w}×{item.defaultSize.h}
                    </span>
                  </div>
                  {item.description && (
                    <div
                      style={{
                        fontSize: 12,
                        lineHeight: 1.45,
                        color: "var(--muted)",
                        fontWeight: 400,
                        whiteSpace: "normal",
                      }}
                    >
                      {item.description}
                    </div>
                  )}
                  <div
                    style={{
                      marginTop: 2,
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "var(--muted)",
                      opacity: 0.7,
                    }}
                  >
                    sql · {item.key}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

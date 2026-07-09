import { useState } from "react";
import { X } from "lucide-react";
import { WIDGETS } from "../widgets/registry";
import { useSqlWidget } from "../api/sqlWidgets";
import type { GridWidget } from "./GridCanvas";
import { effectiveParams, PAGE_RANGES } from "./useLayoutPage";

export default function DrilldownModal({
  widget,
  pageRange,
  onClose,
}: {
  widget: GridWidget;
  pageRange: string;
  onClose: () => void;
}) {
  const base = effectiveParams(widget.params, pageRange);
  const [range, setRange] = useState<string>(String(base.range));
  const def = WIDGETS[widget.kind];
  const sqlId = widget.kind === "sql" ? Number(base.widget_id) : NaN;
  const sqlDef = useSqlWidget(sqlId);
  if (!def) return null;
  const C = def.Component;
  const hasRange = def.paramsSchema.some((f) => f.name === "range");

  return (
    <>
      <div
        data-testid="drilldown-backdrop"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "color-mix(in srgb, var(--ink) 40%, transparent)",
          zIndex: 39,
          animation: "fadeUp 160ms ease-out both",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${def.label} expanded`}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 40,
          width: "min(1100px, 92vw)",
          height: "min(700px, 84vh)",
          background: "var(--bg)",
          border: "1px solid var(--rule)",
          borderRadius: 10,
          boxShadow: "0 32px 80px -28px rgba(0,0,0,0.55)",
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          animation: "fadeUp 200ms ease-out both",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="eyebrow">
            {def.label}
            {widget.app ? ` · ${widget.app}` : ""}
          </span>
          {hasRange && (
            <div role="group" aria-label="Range" style={{ display: "inline-flex", gap: 2 }}>
              {PAGE_RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  aria-pressed={range === r}
                  style={{
                    padding: "4px 8px",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    opacity: range === r ? 1 : 0.5,
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close expanded view"
            style={{
              marginLeft: "auto",
              width: 28,
              height: 28,
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <C app={widget.app} params={{ ...base, range }} />
        </div>
        {widget.kind === "sql" && sqlDef.data?.sql && (
          <details>
            <summary
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--muted)",
                cursor: "pointer",
              }}
            >
              sql
            </summary>
            <pre
              style={{
                margin: "8px 0 0",
                fontSize: 12,
                whiteSpace: "pre-wrap",
                maxHeight: 140,
                overflow: "auto",
              }}
            >
              {sqlDef.data.sql}
            </pre>
          </details>
        )}
      </div>
    </>
  );
}

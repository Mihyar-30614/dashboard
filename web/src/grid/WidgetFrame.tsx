import React from "react";
import { X } from "lucide-react";

type Props = {
  title: string;
  onRemove?: () => void;
  error?: string | null;
  stale?: boolean;
  meta?: string;
  children: React.ReactNode;
};

export default function WidgetFrame({
  title,
  onRemove,
  error,
  stale,
  meta,
  children,
}: Props) {
  return (
    <div
      className="panel fade-up"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        className="widget-drag-handle"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 14,
          gap: 8,
          cursor: "grab",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="eyebrow">{title}</span>
          {meta && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--muted)",
              }}
            >
              {meta}
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {error && (
            <span
              title={error}
              style={{ color: "var(--bad)", display: "flex", gap: 4 }}
            >
              <span className="led led--bad" /> err
            </span>
          )}
          {stale && <span style={{ color: "var(--muted)" }}>stale</span>}
          {onRemove && (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onRemove}
              title="Remove widget"
              aria-label="Remove widget"
              style={{
                width: 22,
                height: 22,
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={12} strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

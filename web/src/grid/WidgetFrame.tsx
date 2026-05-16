import React from "react";

type Props = {
  title: string;
  editing: boolean;
  onRemove?: () => void;
  error?: string | null;
  stale?: boolean;
  children: React.ReactNode;
};

export default function WidgetFrame({
  title,
  editing,
  onRemove,
  error,
  stale,
  children,
}: Props) {
  return (
    <div
      className="panel"
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <strong
          style={{
            fontSize: 12,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {title}
        </strong>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {error && (
            <span title={error} style={{ color: "crimson" }}>
              !
            </span>
          )}
          {stale && (
            <span style={{ color: "var(--muted)", fontSize: 11 }}>stale</span>
          )}
          {editing && onRemove && <button onClick={onRemove}>×</button>}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

export default function EmptyLayout({
  onAdd,
  scope,
}: {
  onAdd: () => void;
  scope: "app" | "overview";
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "60px 24px",
        border: "1px dashed var(--rule)",
        borderRadius: "var(--radius-lg)",
        background: "var(--panel)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {scope === "overview" ? "overview layout" : "property layout"} · empty
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontWeight: 500,
          fontSize: 22,
        }}
      >
        No widgets yet.
      </h2>
      <p
        style={{
          margin: 0,
          color: "var(--ink-soft)",
          maxWidth: 420,
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        Start by adding a KPI, chart, or health widget. You can drag, resize,
        and remove them any time.
      </p>
      <button
        type="button"
        onClick={onAdd}
        style={{
          marginTop: 6,
          padding: "10px 18px",
          background: "var(--accent)",
          color: "var(--accent-ink, #fff)",
          border: "none",
          borderRadius: "var(--radius)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        + Add your first widget
      </button>
    </div>
  );
}

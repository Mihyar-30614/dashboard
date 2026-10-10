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
        border: "1px dashed var(--border)",
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
        Start with the health / PM2 / uptime pack. Press E to edit, A to add.
      </p>
      <button
        type="button"
        onClick={onAdd}
        style={{
          marginTop: 6,
          padding: "10px 18px",
          background: "var(--ink)",
          color: "var(--bg)",
          border: "1px solid var(--ink)",
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

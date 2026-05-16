import { NavLink } from "react-router-dom";

const sections = [
  {
    label: "Surveys",
    items: [{ slug: "overview", label: "Overview", glyph: "◐" }],
  },
  {
    label: "Properties",
    items: [
      { slug: "sportly", label: "Sportly", glyph: "01" },
      { slug: "honeydoeh", label: "Honey Do Eh", glyph: "02" },
      { slug: "debtmanager", label: "DebtManager", glyph: "03" },
    ],
  },
];

export default function Sidebar() {
  return (
    <aside
      style={{
        width: 232,
        flexShrink: 0,
        borderRight: "1px solid var(--rule)",
        padding: "26px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        background: "transparent",
      }}
    >
      <div style={{ paddingLeft: 6 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            fontStyle: "italic",
            fontWeight: 500,
          }}
        >
          Observatory
        </div>
        <div
          className="eyebrow"
          style={{ marginTop: 6, paddingLeft: 0 }}
        >
          v0.1 · ops
        </div>
      </div>

      {sections.map((section) => (
        <div
          key={section.label}
          style={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--muted)",
              padding: "0 8px 6px",
            }}
          >
            {section.label}
          </div>
          {section.items.map((it) => (
            <NavLink
              key={it.slug}
              to={it.slug === "overview" ? "/" : `/app/${it.slug}`}
              end={it.slug === "overview"}
              style={({ isActive }) => ({
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 10px",
                borderRadius: 4,
                textDecoration: "none",
                color: isActive ? "var(--text)" : "var(--ink-soft)",
                background: isActive
                  ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                  : "transparent",
                borderLeft: `2px solid ${
                  isActive ? "var(--accent)" : "transparent"
                }`,
                fontWeight: isActive ? 600 : 400,
                transition: "background 120ms, color 120ms",
              })}
            >
              <span
                aria-hidden
                className="metric"
                style={{
                  fontSize: 10,
                  color: "var(--muted)",
                  width: 18,
                  textAlign: "center",
                }}
              >
                {it.glyph}
              </span>
              <span>{it.label}</span>
            </NavLink>
          ))}
        </div>
      ))}

      <div style={{ marginTop: "auto", paddingLeft: 8 }}>
        <NavLink
          to="/settings"
          style={({ isActive }) => ({
            display: "block",
            padding: "8px 0",
            color: isActive ? "var(--accent)" : "var(--muted)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            textDecoration: "none",
          })}
        >
          → Settings
        </NavLink>
      </div>
    </aside>
  );
}

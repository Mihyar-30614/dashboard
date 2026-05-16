import { NavLink } from "react-router-dom";

const apps = [
  { slug: "overview", label: "Overview" },
  { slug: "sportly", label: "Sportly" },
  { slug: "honeydoeh", label: "Honey Do Eh" },
  { slug: "debtmanager", label: "DebtManager" },
];

export default function Sidebar() {
  return (
    <aside
      style={{
        width: 200,
        borderRight: "1px solid var(--border)",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        background: "var(--panel)",
      }}
    >
      {apps.map((a) => (
        <NavLink
          key={a.slug}
          to={a.slug === "overview" ? "/" : `/app/${a.slug}`}
          style={({ isActive }) => ({
            padding: "8px 10px",
            borderRadius: 6,
            textDecoration: "none",
            color: isActive ? "var(--accent)" : "var(--text)",
            background: isActive ? "var(--grid-line)" : "transparent",
          })}
        >
          {a.label}
        </NavLink>
      ))}
    </aside>
  );
}

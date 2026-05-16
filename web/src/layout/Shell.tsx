import { Outlet, Link } from "react-router-dom";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";

export default function Shell() {
  return (
    <div style={{ display: "flex", height: "100%" }}>
      <Sidebar />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--panel)",
          }}
        >
          <strong>Apps Dashboard</strong>
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/settings">Settings</Link>
            <ThemeToggle />
          </div>
        </header>
        <main style={{ flex: 1, padding: 16, overflow: "auto" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

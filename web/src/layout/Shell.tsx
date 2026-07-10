import { Outlet, useLocation, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "./Sidebar";
import { useApps, useMe } from "../api/hooks";

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function useSectionLabel() {
  const loc = useLocation();
  const params = useParams();
  const apps = useApps();
  return useMemo(() => {
    const p = loc.pathname;
    if (p === "/" || p === "") return "Overview";
    if (p.startsWith("/analytics")) return "Analytics";
    if (p.startsWith("/settings")) return "Settings";
    if (p.startsWith("/app/")) {
      const slug = p.split("/")[2] || params.slug;
      const meta = (apps.data as any[] | undefined)?.find(
        (a) => a.slug === slug,
      );
      return meta?.label || slug || "Property";
    }
    return "";
  }, [loc.pathname, params.slug, apps.data]);
}

export default function Shell() {
  const me = useMe();
  const now = useNow();
  const section = useSectionLabel();
  const stamp =
    now.toISOString().slice(11, 19) + " UTC · " + now.toISOString().slice(0, 10);

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
            padding: "14px 28px",
            borderBottom: "1px solid var(--border)",
            background: "transparent",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            <span>
              <span className="led led--ok" style={{ marginRight: 8 }} />
              live
            </span>
            <span style={{ color: "var(--ink-soft)" }}>{stamp}</span>
            {section && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  paddingLeft: 18,
                  borderLeft: "1px solid var(--border)",
                  color: "var(--muted)",
                }}
              >
                <span style={{ color: "var(--muted)" }}>section</span>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontStyle: "italic",
                    fontWeight: 500,
                    fontSize: 14,
                    letterSpacing: "-0.01em",
                    textTransform: "none",
                    color: "var(--text)",
                  }}
                >
                  {section}
                </span>
              </span>
            )}
          </div>

          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--muted)",
            }}
          >
            {me.data?.email}
          </span>
        </header>
        <main
          style={{
            flex: 1,
            padding: "28px 32px 64px",
            overflow: "auto",
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Hammer,
  LayoutDashboard,
  RefreshCw,
  Settings,
  Sparkles,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";

type Item = {
  slug: string;
  label: string;
  Icon: LucideIcon;
  path: string;
  end?: boolean;
};

const sections: { label: string; items: Item[] }[] = [
  {
    label: "Surveys",
    items: [
      { slug: "overview", label: "Overview", Icon: LayoutDashboard, path: "/", end: true },
    ],
  },
  {
    label: "Analytics",
    items: [
      { slug: "analytics", label: "Ask DB", Icon: Sparkles, path: "/analytics" },
    ],
  },
  {
    label: "Properties",
    items: [
      { slug: "sportly", label: "Sportly", Icon: Trophy, path: "/app/sportly" },
      { slug: "honeydoeh", label: "Honey Do Eh", Icon: Hammer, path: "/app/honeydoeh" },
      { slug: "debtmanager", label: "DebtManager", Icon: Wallet, path: "/app/debtmanager" },
    ],
  },
];

const STORAGE_KEY = "sidebar:collapsed";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const qc = useQueryClient();
  const fetching = useIsFetching() > 0;

  function refresh() {
    if (fetching) return;
    qc.invalidateQueries();
  }

  return (
    <aside
      style={{
        width: collapsed ? 60 : 232,
        flexShrink: 0,
        borderRight: "1px solid var(--rule)",
        padding: collapsed ? "26px 8px" : "26px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        background: "transparent",
        transition: "width 160ms ease, padding 160ms ease",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          paddingLeft: collapsed ? 0 : 6,
          gap: 8,
        }}
      >
        {!collapsed && (
          <div>
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
            <div className="eyebrow" style={{ marginTop: 6, paddingLeft: 0 }}>
              v0.1 · ops
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            width: 28,
            height: 28,
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "1px solid var(--rule)",
            borderRadius: 4,
            color: "var(--muted)",
            cursor: "pointer",
          }}
        >
          {collapsed ? (
            <ChevronRight size={14} strokeWidth={1.8} />
          ) : (
            <ChevronLeft size={14} strokeWidth={1.8} />
          )}
        </button>
      </div>

      {sections.map((section) => (
        <div
          key={section.label}
          style={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          {!collapsed && (
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
          )}
          {section.items.map((it) => {
            const Icon = it.Icon;
            return (
              <NavLink
                key={it.slug}
                to={it.path}
                end={it.end}
                title={collapsed ? it.label : undefined}
                style={({ isActive }) => ({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: collapsed ? "center" : "flex-start",
                  gap: 10,
                  padding: collapsed ? "9px 0" : "9px 10px",
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
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 22,
                        height: 22,
                        color: isActive ? "var(--accent)" : "var(--muted)",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={16} strokeWidth={1.7} />
                    </span>
                    {!collapsed && <span>{it.label}</span>}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      ))}

      <div
        style={{
          marginTop: "auto",
          paddingLeft: collapsed ? 0 : 8,
          textAlign: collapsed ? "center" : "left",
        }}
      >
        <button
          type="button"
          onClick={refresh}
          disabled={fetching}
          title={collapsed ? "Refresh data" : undefined}
          aria-label="Refresh dashboard data"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 8,
            width: "100%",
            padding: "8px 0",
            background: "transparent",
            border: "none",
            color: "var(--muted)",
            fontFamily: "var(--font-mono)",
            fontSize: collapsed ? 14 : 10,
            letterSpacing: collapsed ? "0" : "0.18em",
            textTransform: "uppercase",
            cursor: fetching ? "default" : "pointer",
            opacity: fetching ? 0.6 : 1,
          }}
        >
          <span
            aria-hidden
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              flexShrink: 0,
              animation: fetching ? "spin 0.9s linear infinite" : "none",
            }}
          >
            <RefreshCw size={16} strokeWidth={1.7} />
          </span>
          {!collapsed && <span>Refresh</span>}
        </button>
        <NavLink
          to="/settings"
          title={collapsed ? "Settings" : undefined}
          style={({ isActive }) => ({
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 8,
            padding: "8px 0",
            color: isActive ? "var(--accent)" : "var(--muted)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: collapsed ? "0" : "0.18em",
            textTransform: "uppercase",
            textDecoration: "none",
          })}
        >
          <span
            aria-hidden
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 22,
              height: 22,
              flexShrink: 0,
            }}
          >
            <Settings size={16} strokeWidth={1.7} />
          </span>
          {!collapsed && <span>Settings</span>}
        </NavLink>
      </div>
    </aside>
  );
}

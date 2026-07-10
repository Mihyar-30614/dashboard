import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Hammer,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  Sparkles,
  Sun,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { api } from "../api/client";
import { useApps } from "../api/hooks";
import { hasDirty } from "../grid/savingRegistry";
import { useToast } from "../ui/Toast";
import ConfirmDialog from "../ui/ConfirmDialog";

type Item = {
  slug: string;
  label: string;
  Icon: LucideIcon;
  path: string;
  end?: boolean;
};

const APP_ICONS: Record<string, LucideIcon> = {
  sportly: Trophy,
  honeydoeh: Hammer,
  debtmanager: Wallet,
};

const STATIC_SECTIONS: { label: string; items: Item[] }[] = [
  {
    label: "Surveys",
    items: [
      {
        slug: "overview",
        label: "Overview",
        Icon: LayoutDashboard,
        path: "/",
        end: true,
      },
    ],
  },
  {
    label: "Analytics",
    items: [
      {
        slug: "analytics",
        label: "Ask DB",
        Icon: Sparkles,
        path: "/analytics",
      },
    ],
  },
];

const STORAGE_KEY = "sidebar:collapsed";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });
  const { data: appList } = useApps();

  const sections = useMemo(() => {
    const propertyItems: Item[] = (appList ?? []).map((a) => ({
      slug: a.slug,
      label: a.label,
      Icon: APP_ICONS[a.slug] ?? Box,
      path: `/app/${a.slug}`,
    }));
    return [
      ...STATIC_SECTIONS,
      ...(propertyItems.length
        ? [{ label: "Properties", items: propertyItems }]
        : []),
    ];
  }, [appList]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();

  const [theme, setTheme] = useState<"light" | "dark">(
    () =>
      (typeof document !== "undefined" &&
        (document.documentElement.dataset.theme as "light" | "dark")) ||
      "light",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
    window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
  }, [theme]);

  const [confirmLogout, setConfirmLogout] = useState(false);

  function requestLogout() {
    if (hasDirty()) setConfirmLogout(true);
    else logout();
  }

  async function logout() {
    setConfirmLogout(false);
    try {
      await api.post("/api/auth/logout");
    } catch (e) {
      toast.error("Logout failed: " + ((e as Error).message ?? "unknown"));
      return;
    }
    qc.clear();
    nav("/login", { replace: true });
  }

  return (
    <aside
      style={{
        width: collapsed ? 60 : 232,
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        padding: collapsed ? "26px 8px" : "26px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 24,
        background: "transparent",
        transition: "width var(--duration-normal) ease, padding var(--duration-normal) ease",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: collapsed ? "column" : "row",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          paddingLeft: collapsed ? 0 : 6,
          gap: collapsed ? 10 : 8,
        }}
      >
        {collapsed ? (
          <img
            src="/icon.svg"
            alt="Observatory"
            width={32}
            height={32}
            style={{ display: "block", borderRadius: "var(--radius)" }}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src="/icon.svg"
              alt=""
              aria-hidden
              width={28}
              height={28}
              style={{ display: "block", borderRadius: "var(--radius)", flexShrink: 0 }}
            />
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
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
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
                  padding: collapsed ? "9px 0" : "9px 12px",
                  borderRadius: "var(--radius-lg)",
                  textDecoration: "none",
                  color: isActive ? "var(--text)" : "var(--ink-soft)",
                  background: isActive
                    ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                    : "transparent",
                  fontWeight: isActive ? 600 : 400,
                  transition: "background var(--duration-fast), color var(--duration-fast)",
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
        <UtilButton
          onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          collapsed={collapsed}
          label={theme === "light" ? "Dark mode" : "Light mode"}
          title={
            collapsed
              ? theme === "light"
                ? "Switch to dark"
                : "Switch to light"
              : undefined
          }
          ariaLabel="Toggle theme"
          icon={
            theme === "light" ? (
              <Moon size={16} strokeWidth={1.7} />
            ) : (
              <Sun size={16} strokeWidth={1.7} />
            )
          }
        />
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
        <UtilButton
          onClick={requestLogout}
          collapsed={collapsed}
          label="Sign out"
          title={collapsed ? "Sign out" : undefined}
          ariaLabel="Sign out"
          icon={<LogOut size={16} strokeWidth={1.7} />}
        />
      </div>
      <ConfirmDialog
        open={confirmLogout}
        title="Sign out"
        message="Layout has unsaved changes that will be lost. Sign out anyway?"
        confirmLabel="Sign out"
        onConfirm={logout}
        onCancel={() => setConfirmLogout(false)}
      />
    </aside>
  );
}

function UtilButton({
  onClick,
  disabled,
  collapsed,
  label,
  title,
  ariaLabel,
  icon,
}: {
  onClick: () => void;
  disabled?: boolean;
  collapsed: boolean;
  label: string;
  title?: string;
  ariaLabel: string;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
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
        fontSize: 10,
        letterSpacing: collapsed ? "0" : "0.18em",
        textTransform: "uppercase",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
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
        }}
      >
        {icon}
      </span>
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

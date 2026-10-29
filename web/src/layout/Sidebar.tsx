import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Box,
  ChevronsLeft,
  ChevronsRight,
  Hammer,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  Sparkles,
  Sun,
  Trophy,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { api } from "../api/client";
import { useMe } from "../api/hooks";
import { hasDirty } from "../grid/savingRegistry";
import { useToast } from "../ui/Toast";
import ConfirmDialog from "../ui/ConfirmDialog";
import { useFleet, type FleetApp } from "./fleet";

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

const PRIMARY: Item[] = [
  { slug: "overview", label: "Overview", Icon: LayoutDashboard, path: "/", end: true },
  { slug: "analytics", label: "Ask DB", Icon: Sparkles, path: "/analytics" },
];

const STORAGE_KEY = "sidebar:collapsed";
const NARROW = "(max-width: 900px)";

function initials(email: string | undefined): string {
  if (!email) return "·";
  const name = email.split("@")[0].replace(/[^a-z]/gi, "");
  return (name.slice(0, 2) || "·").toUpperCase();
}

export default function Sidebar({
  drawerOpen,
  onCloseDrawer,
}: {
  /** Narrow viewports show the sidebar as a drawer the shell header opens. */
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });
  const [narrow, setNarrow] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia(NARROW).matches : false,
  );
  // The drawer always shows labels; only the desktop sidebar collapses.
  const rail = collapsed && !narrow;
  const fleet = useFleet();
  const me = useMe();

  const appItems = useMemo(
    () =>
      fleet.apps.map((a) => ({
        app: a,
        item: {
          slug: a.slug,
          label: a.label,
          Icon: APP_ICONS[a.slug] ?? Box,
          path: `/app/${a.slug}`,
        } satisfies Item,
      })),
    [fleet.apps],
  );

  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    // Persist only the user's explicit choice — not viewport-forced collapse.
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseDrawer();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, onCloseDrawer]);

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

  const email = me.data?.email;
  const upCount = fleet.apps.filter((a) => a.state === "ok").length;

  return (
    <>
      <aside
        className={
          "sidebar" +
          (rail ? " is-rail" : "") +
          (narrow ? " is-drawer" : "") +
          (narrow && drawerOpen ? " is-open" : "")
        }
        aria-label="Main navigation"
      >
        <div className="sidebar__brand">
          <img src="/icon.svg" alt="" aria-hidden width={30} height={30} />
          {!rail && (
            <div className="sidebar__wordmark">
              <span className="sidebar__name">Observatory</span>
              <span className="sidebar__version">v0.1 · ops</span>
            </div>
          )}
          {narrow && (
            <button
              type="button"
              className="sidebar__icon-btn sidebar__close"
              onClick={onCloseDrawer}
              aria-label="Close navigation"
            >
              <X size={16} strokeWidth={1.8} />
            </button>
          )}
        </div>

        <nav className="sidebar__nav">
          <div className="sidebar__group">
            {PRIMARY.map((it) => (
              <NavItem key={it.slug} item={it} rail={rail} />
            ))}
          </div>

          {appItems.length > 0 && (
            <div className="sidebar__group">
              {!rail && (
                <div className="sidebar__label">
                  <span>Apps</span>
                  <span className={`sidebar__label-meta is-${fleet.worst}`}>
                    {upCount}/{fleet.total} up
                  </span>
                </div>
              )}
              {appItems.map(({ app, item }) => (
                <NavItem key={item.slug} item={item} rail={rail} app={app} />
              ))}
            </div>
          )}
        </nav>

        <div className="sidebar__foot">
          <div className="sidebar__account" title={email}>
            <span className="sidebar__avatar" aria-hidden>
              {initials(email)}
            </span>
            {!rail && (
              <span className="sidebar__who">
                <span className="sidebar__email">{email ?? "…"}</span>
                <span className="sidebar__role">{me.data?.is_admin ? "Admin" : "Member"}</span>
              </span>
            )}
          </div>
          <div className="sidebar__tools">
            <button
              type="button"
              className="sidebar__icon-btn"
              onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              title={theme === "light" ? "Switch to dark" : "Switch to light"}
              aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            >
              {theme === "light" ? (
                <Moon size={15} strokeWidth={1.8} />
              ) : (
                <Sun size={15} strokeWidth={1.8} />
              )}
            </button>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                "sidebar__icon-btn" + (isActive ? " is-active" : "")
              }
              title="Settings"
              aria-label="Settings"
            >
              <Settings size={15} strokeWidth={1.8} />
            </NavLink>
            <button
              type="button"
              className="sidebar__icon-btn"
              onClick={requestLogout}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={15} strokeWidth={1.8} />
            </button>
            {!narrow && (
              <button
                type="button"
                className="sidebar__icon-btn sidebar__collapse"
                onClick={() => setCollapsed((v) => !v)}
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <ChevronsRight size={15} strokeWidth={1.8} />
                ) : (
                  <ChevronsLeft size={15} strokeWidth={1.8} />
                )}
              </button>
            )}
          </div>
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
      {narrow && drawerOpen && <div className="sidebar-backdrop" onClick={onCloseDrawer} />}
    </>
  );
}

function NavItem({ item, rail, app }: { item: Item; rail: boolean; app?: FleetApp }) {
  const Icon = item.Icon;
  return (
    <NavLink
      to={item.path}
      end={item.end}
      className={({ isActive }) => "sidebar__item" + (isActive ? " is-active" : "")}
      title={rail ? (app ? `${item.label} · ${app.detail}` : item.label) : app?.detail}
    >
      <span className="sidebar__icon" aria-hidden>
        <Icon size={16} strokeWidth={1.7} />
        {app && rail && <span className={`sidebar__badge is-${app.state}`} />}
      </span>
      {!rail && <span className="sidebar__text">{item.label}</span>}
      {app && !rail && (
        <span className={`sidebar__status is-${app.state}`}>
          <span className="sidebar__ms">
            {app.latencyMs == null ? "down" : `${app.latencyMs}ms`}
          </span>
          <span className="sidebar__led" aria-hidden />
          <span className="sr-only">{app.detail}</span>
        </span>
      )}
    </NavLink>
  );
}

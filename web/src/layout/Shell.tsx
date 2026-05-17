import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import Sidebar from "./Sidebar";
import ThemeToggle from "./ThemeToggle";
import { useMe } from "../api/hooks";
import { api } from "../api/client";
import { hasDirty } from "../grid/savingRegistry";
import { useToast } from "../ui/Toast";

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function Shell() {
  const me = useMe();
  const now = useNow();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  async function logout() {
    if (hasDirty()) {
      const ok = window.confirm(
        "Layout has unsaved changes. Sign out anyway?",
      );
      if (!ok) return;
    }
    try {
      await api.post("/api/auth/logout");
    } catch (e) {
      toast.error(
        "Logout failed: " + ((e as Error).message ?? "unknown"),
      );
      return;
    }
    qc.clear();
    nav("/login", { replace: true });
  }
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
            borderBottom: "1px solid var(--rule)",
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
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--muted)",
              }}
            >
              {me.data?.email}
            </span>
            <button
              type="button"
              onClick={logout}
              title="Sign out"
              style={{
                width: 34,
                height: 34,
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LogOut size={16} strokeWidth={1.7} />
            </button>
            <ThemeToggle />
          </div>
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

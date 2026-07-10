import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastKind = "info" | "success" | "warn" | "error";

type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
};

type Ctx = {
  push: (kind: ToastKind, message: string) => void;
  info: (m: string) => void;
  success: (m: string) => void;
  warn: (m: string) => void;
  error: (m: string) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

const TTL = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, number>());

  const remove = useCallback((id: string) => {
    setItems((arr) => arr.filter((t) => t.id !== id));
    const h = timers.current.get(id);
    if (h) {
      window.clearTimeout(h);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = "t_" + Math.random().toString(36).slice(2, 9);
      setItems((arr) => [...arr, { id, kind, message }]);
      const h = window.setTimeout(() => remove(id), TTL);
      timers.current.set(id, h);
    },
    [remove],
  );

  const value = useMemo<Ctx>(
    () => ({
      push,
      info: (m) => push("info", m),
      success: (m) => push("success", m),
      warn: (m) => push("warn", m),
      error: (m) => push("error", m),
    }),
    [push],
  );

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div
        style={{
          position: "fixed",
          right: 18,
          bottom: 18,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 1000,
          pointerEvents: "none",
        }}
      >
        {items.map((t) => (
          <ToastItem key={t.id} t={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastItem({ t, onClose }: { t: Toast; onClose: () => void }) {
  const palette: Record<ToastKind, { fg: string; bg: string; led: string }> = {
    info: {
      fg: "var(--text)",
      bg: "var(--panel)",
      led: "var(--accent)",
    },
    success: {
      fg: "var(--text)",
      bg: "var(--panel)",
      led: "var(--good, #3aa66e)",
    },
    warn: {
      fg: "var(--text)",
      bg: "var(--panel)",
      led: "var(--warn, #d6a23a)",
    },
    error: {
      fg: "var(--text)",
      bg: "var(--panel)",
      led: "var(--bad, #d54a4a)",
    },
  };
  const c = palette[t.kind];
  return (
    <div
      role="status"
      style={{
        pointerEvents: "auto",
        minWidth: 240,
        maxWidth: 380,
        padding: "10px 14px 10px 12px",
        background: c.bg,
        color: c.fg,
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${c.led}`,
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-md)",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        fontSize: 13,
        lineHeight: 1.45,
        animation: "fadeUp 200ms ease-out both",
      }}
    >
      <span style={{ flex: 1, whiteSpace: "pre-wrap" }}>{t.message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        style={{
          padding: 0,
          width: 18,
          height: 18,
          background: "transparent",
          border: "none",
          color: "var(--muted)",
          cursor: "pointer",
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

import { useEffect, useRef } from "react";

// App-styled replacement for window.confirm: centered panel over a dimmed
// backdrop with explicit confirm / cancel actions.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Yes",
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        data-testid="confirm-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) onCancel();
        }}
        style={{
          position: "fixed",
          inset: 0,
          background: "color-mix(in srgb, var(--ink) 35%, transparent)",
          zIndex: 50,
          display: "grid",
          placeItems: "center",
        }}
      >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        style={{
          width: "min(360px, calc(100vw - 48px))",
          padding: 20,
          background: "var(--panel)",
          border: "1px solid color-mix(in srgb, var(--rule) 70%, transparent)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-md)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          animation: "fadeUp 180ms ease-out both",
        }}
      >
        <span className="eyebrow">{title}</span>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button ref={cancelRef} type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={danger ? { color: "var(--bad)", borderColor: "color-mix(in srgb, var(--bad) 45%, var(--rule))" } : undefined}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
      </div>
    </>
  );
}

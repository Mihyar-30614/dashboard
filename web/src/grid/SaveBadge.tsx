import { useEffect, useState } from "react";

export type SaveState = "idle" | "dirty" | "saving" | "saved";

function relative(from: Date, now: Date) {
  const s = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function SaveBadge({
  state,
  lastSavedAt,
}: {
  state: SaveState;
  lastSavedAt: Date | null;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);

  let led = "led--ok";
  let label = "Synced";
  if (state === "dirty") {
    led = "led--warn";
    label = "Unsaved changes";
  } else if (state === "saving") {
    led = "led--warn";
    label = "Saving…";
  } else if (state === "saved") {
    led = "led--ok";
    label = "Saved";
  } else if (!lastSavedAt) {
    label = "Default layout";
  }

  const stamp = lastSavedAt ? relative(lastSavedAt, now) : null;
  const absolute = lastSavedAt
    ? lastSavedAt.toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <span
      title={absolute || undefined}
      style={{
        display: "inline-flex",
        gap: 8,
        alignItems: "center",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "var(--muted)",
      }}
    >
      <span className={`led ${led}`} />
      <span>{label}</span>
      {stamp && state !== "saving" && state !== "dirty" && (
        <span style={{ color: "var(--ink-soft)" }}>· {stamp}</span>
      )}
    </span>
  );
}

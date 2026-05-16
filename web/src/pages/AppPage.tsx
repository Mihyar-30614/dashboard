import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import GridCanvas, { type GridWidget } from "../grid/GridCanvas";
import WidgetFrame from "../grid/WidgetFrame";
import { useLayout, useSaveLayout, useApps } from "../api/hooks";
import { WIDGETS } from "../widgets/registry";
import WidgetPalette from "../grid/WidgetPalette";

type SaveState = "idle" | "dirty" | "saving" | "saved";

export default function AppPage() {
  const { slug = "" } = useParams();
  const layoutQ = useLayout(slug);
  const apps = useApps();
  const save = useSaveLayout(slug);
  const [local, setLocal] = useState<GridWidget[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timer = useRef<number | null>(null);
  const skipNextChange = useRef(true);

  useEffect(() => {
    if (layoutQ.data) {
      skipNextChange.current = true;
      setLocal(layoutQ.data.layout);
      setSaveState("idle");
    }
  }, [layoutQ.data]);

  const meta = (apps.data as any[])?.find((a) => a.slug === slug);

  function scheduleSave(next: GridWidget[]) {
    setSaveState("dirty");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setSaveState("saving");
      await save.mutateAsync(next);
      setSaveState("saved");
      window.setTimeout(
        () =>
          setSaveState((s) => (s === "saved" ? "idle" : s)),
        1400,
      );
    }, 800);
  }

  function onChange(next: GridWidget[]) {
    setLocal(next);
    if (skipNextChange.current) {
      skipNextChange.current = false;
      return;
    }
    scheduleSave(next);
  }

  function remove(id: string) {
    const next = local.filter((w) => w.id !== id);
    setLocal(next);
    scheduleSave(next);
  }
  function add(kind: string) {
    const def = WIDGETS[kind];
    if (!def) return;
    const next = [
      ...local,
      {
        id: "w_" + Math.random().toString(36).slice(2, 8),
        kind,
        app: slug,
        x: 0,
        y: 100,
        w: def.defaultSize.w,
        h: def.defaultSize.h,
        params: {},
      },
    ];
    setLocal(next);
    scheduleSave(next);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 18,
        }}
      >
        <div>
          <span className="eyebrow">property</span>
          <h1 style={{ marginTop: 6 }}>
            <em
              style={{
                fontStyle: "italic",
                fontWeight: 500,
                color: "var(--accent)",
              }}
            >
              {meta?.label || slug}
            </em>
          </h1>
          <div
            style={{
              marginTop: 6,
              display: "flex",
              gap: 14,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--muted)",
              letterSpacing: "0.06em",
            }}
          >
            <span>slug: {slug}</span>
            {meta && (
              <>
                <span>· pm2: {meta.pm2_status}</span>
                <span>· health: {meta.health?.ok ? "up" : "down"}</span>
              </>
            )}
          </div>
        </div>
        <ActionBar
          saveState={saveState}
          onAdd={() => setPaletteOpen(true)}
        />
      </header>

      <GridCanvas
        widgets={local}
        onChange={onChange}
        renderWidget={(w) => {
          const def = WIDGETS[w.kind];
          if (!def)
            return (
              <WidgetFrame title={w.kind} onRemove={() => remove(w.id)}>
                Unknown widget
              </WidgetFrame>
            );
          const C = def.Component;
          return (
            <C
              app={w.app}
              params={w.params}
              onRemove={() => remove(w.id)}
            />
          );
        }}
      />
      <WidgetPalette
        open={paletteOpen}
        scope="app"
        onPick={add}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}

function ActionBar({
  saveState,
  onAdd,
}: {
  saveState: SaveState;
  onAdd: () => void;
}) {
  const label =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Saved"
        : saveState === "dirty"
          ? "Unsaved"
          : "Synced";
  const led =
    saveState === "dirty"
      ? "led--warn"
      : saveState === "saving"
        ? "led--warn"
        : "led--ok";
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        <span className={`led ${led}`} style={{ marginRight: 8 }} />
        {label}
      </span>
      <button type="button" onClick={onAdd}>
        + Add widget
      </button>
    </div>
  );
}

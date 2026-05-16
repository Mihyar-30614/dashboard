import { useEffect, useRef, useState } from "react";
import GridCanvas, { type GridWidget } from "../grid/GridCanvas";
import WidgetFrame from "../grid/WidgetFrame";
import { useLayout, useSaveLayout, useApps } from "../api/hooks";
import { WIDGETS } from "../widgets/registry";
import WidgetPalette from "../grid/WidgetPalette";

type SaveState = "idle" | "dirty" | "saving" | "saved";

export default function Overview() {
  const layoutQ = useLayout("overview");
  const apps = useApps();
  const save = useSaveLayout("overview");
  const [local, setLocal] = useState<GridWidget[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (layoutQ.data) {
      setLocal(layoutQ.data.layout);
      setSaveState("idle");
    }
  }, [layoutQ.data]);

  function scheduleSave(next: GridWidget[]) {
    setSaveState("dirty");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setSaveState("saving");
      await save.mutateAsync(next);
      setSaveState("saved");
      window.setTimeout(
        () => setSaveState((s) => (s === "saved" ? "idle" : s)),
        1400,
      );
    }, 800);
  }

  function onChange(next: GridWidget[]) {
    setLocal(next);
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
    const firstApp = (apps.data as any)?.[0]?.slug;
    const next = [
      ...local,
      {
        id: "w_" + Math.random().toString(36).slice(2, 8),
        kind,
        app: firstApp,
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

  const list = (apps.data as any[]) || [];
  const onlineCount = list.filter((a) => a.pm2_status === "online").length;
  const upCount = list.filter((a) => a.health?.ok).length;

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
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
        <div>
          <span className="eyebrow">overview · all properties</span>
          <h1 style={{ marginTop: 6 }}>
            <em
              style={{
                fontStyle: "italic",
                color: "var(--accent)",
                fontWeight: 500,
              }}
            >
              Three
            </em>{" "}
            applications,
            <br />
            one pane of glass.
          </h1>
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "grid",
            gridTemplateColumns: "auto auto auto",
            gap: 22,
            padding: "16px 22px",
            border: "1px solid var(--rule)",
            borderRadius: 8,
            background: "var(--panel)",
          }}
        >
          {[
            { k: "Apps", v: list.length || "—" },
            { k: "Online", v: list.length ? `${onlineCount}/${list.length}` : "—" },
            { k: "Healthy", v: list.length ? `${upCount}/${list.length}` : "—" },
          ].map((s) => (
            <div key={s.k}>
              <div className="eyebrow" style={{ fontSize: 9 }}>
                {s.k}
              </div>
              <div className="metric metric--lg" style={{ marginTop: 4 }}>
                {s.v}
              </div>
            </div>
          ))}
        </div>
      </header>

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
        <button type="button" onClick={() => setPaletteOpen(true)}>
          + Add widget
        </button>
      </div>

      <GridCanvas
        widgets={local}
        onChange={onChange}
        renderWidget={(w) => {
          const def = WIDGETS[w.kind];
          if (!def)
            return (
              <WidgetFrame title={w.kind} onRemove={() => remove(w.id)}>
                Unknown
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
        scope="overview"
        onPick={add}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}

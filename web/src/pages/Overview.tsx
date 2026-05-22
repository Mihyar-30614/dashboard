import { useEffect, useRef, useState } from "react";
import GridCanvas, { type GridWidget } from "../grid/GridCanvas";
import WidgetFrame from "../grid/WidgetFrame";
import { useLayout, useSaveLayout, useApps } from "../api/hooks";
import { WIDGETS } from "../widgets/registry";
import WidgetPalette, { type DynamicPaletteItem } from "../grid/WidgetPalette";
import { useSqlWidgets, useSqlDataSources } from "../api/sqlWidgets";
import SaveBadge, { type SaveState } from "../grid/SaveBadge";
import EmptyLayout from "../grid/EmptyLayout";
import { setPageDirty } from "../grid/savingRegistry";
import { useToast } from "../ui/Toast";
import WidgetErrorBoundary from "../grid/WidgetErrorBoundary";

export default function Overview() {
  const layoutQ = useLayout("overview");
  const apps = useApps();
  const save = useSaveLayout("overview");
  const sqlList = useSqlWidgets();
  const sqlSources = useSqlDataSources();
  const toast = useToast();
  const [local, setLocal] = useState<GridWidget[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (layoutQ.data) {
      setLocal(layoutQ.data.layout);
      setSaveState("idle");
      if (layoutQ.data.updated_at)
        setLastSavedAt(new Date(layoutQ.data.updated_at));
    }
  }, [layoutQ.data]);

  useEffect(() => {
    setPageDirty("overview", saveState === "dirty" || saveState === "saving");
    return () => setPageDirty("overview", false);
  }, [saveState]);

  function scheduleSave(next: GridWidget[]) {
    setSaveState("dirty");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        const res = await save.mutateAsync(next);
        if (res?.updated_at) setLastSavedAt(new Date(res.updated_at));
        setSaveState("saved");
        window.setTimeout(
          () => setSaveState((s) => (s === "saved" ? "idle" : s)),
          1400,
        );
      } catch (e) {
        setSaveState("dirty");
        toast.error(
          "Failed to save layout: " + ((e as Error).message ?? "unknown"),
        );
      }
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
    const nextY = local.reduce((m, w) => Math.max(m, w.y + w.h), 0);
    const next = [
      ...local,
      {
        id: "w_" + Math.random().toString(36).slice(2, 8),
        kind,
        app: firstApp,
        x: 0,
        y: nextY,
        w: def.defaultSize.w,
        h: def.defaultSize.h,
        params: {},
      },
    ];
    setLocal(next);
    scheduleSave(next);
  }

  function addSql(widget: { id: number }) {
    const nextY = local.reduce((m, w) => Math.max(m, w.y + w.h), 0);
    const next = [
      ...local,
      {
        id: "w_" + Math.random().toString(36).slice(2, 8),
        kind: "sql",
        x: 0, y: nextY, w: 3, h: 2,
        params: { widget_id: widget.id, range: "30d" },
      },
    ];
    setLocal(next);
    scheduleSave(next);
  }

  const dynamicPalette: DynamicPaletteItem[] = (sqlList.data ?? [])
    .filter(w => {
      const src = (sqlSources.data ?? []).find(s => s.name === w.data_source);
      return src?.scope === "overview";
    })
    .map(w => ({
      key: `sql:${w.id}`,
      label: w.name,
      description: w.description ?? "",
      defaultSize: { w: 3, h: 2 },
      scope: "overview" as const,
      onPick: () => addSql(w),
    }));

  const list = (apps.data as any[]) || [];
  const onlineCount = list.filter((a) => a.pm2_status === "online").length;
  const upCount = list.filter((a) => a.health?.ok).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
        <div>
          <span className="eyebrow">overview · all properties</span>
          <h1 style={{ marginTop: 6 }}>
            Every property,
            <br />
            <em
              style={{
                fontStyle: "italic",
                color: "var(--accent)",
                fontWeight: 500,
              }}
            >
              one
            </em>{" "}
            pane of glass.
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

      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <SaveBadge state={saveState} lastSavedAt={lastSavedAt} />
        <button type="button" onClick={() => setPaletteOpen(true)}>
          + Add widget
        </button>
      </div>

      {layoutQ.data && local.length === 0 ? (
        <EmptyLayout scope="overview" onAdd={() => setPaletteOpen(true)} />
      ) : (
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
              <WidgetErrorBoundary
                key={w.id}
                kind={w.kind}
                onRemove={() => remove(w.id)}
              >
                <C
                  app={w.app}
                  params={w.params}
                  onRemove={() => remove(w.id)}
                />
              </WidgetErrorBoundary>
            );
          }}
        />
      )}
      <WidgetPalette
        open={paletteOpen}
        scope="overview"
        dynamic={dynamicPalette}
        onPick={add}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
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

export default function AppPage() {
  const { slug = "" } = useParams();
  const layoutQ = useLayout(slug);
  const apps = useApps();
  const save = useSaveLayout(slug);
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
    setPageDirty(`app:${slug}`, saveState === "dirty" || saveState === "saving");
    return () => setPageDirty(`app:${slug}`, false);
  }, [saveState, slug]);

  const meta = (apps.data as any[])?.find((a) => a.slug === slug);

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
    const nextY = local.reduce((m, w) => Math.max(m, w.y + w.h), 0);
    const next = [
      ...local,
      {
        id: "w_" + Math.random().toString(36).slice(2, 8),
        kind,
        app: slug,
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
        app: slug,
        x: 0, y: nextY, w: 3, h: 2,
        params: { widget_id: widget.id, range: "30d" },
      },
    ];
    setLocal(next);
    scheduleSave(next);
  }

  const dynamicPalette: DynamicPaletteItem[] = (sqlList.data ?? []).map(w => {
    const src = (sqlSources.data ?? []).find(s => s.name === w.data_source);
    return {
      key: `sql:${w.id}`,
      label: w.name,
      description: w.description ?? "",
      defaultSize: { w: 3, h: 2 },
      scope: (src?.scope ?? "app") as "app" | "overview",
      appSlug: src?.app_slug,
      onPick: () => addSql(w),
    };
  });

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
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <SaveBadge state={saveState} lastSavedAt={lastSavedAt} />
          <button type="button" onClick={() => setPaletteOpen(true)}>
            + Add widget
          </button>
        </div>
      </header>

      {layoutQ.data && local.length === 0 ? (
        <EmptyLayout scope="app" onAdd={() => setPaletteOpen(true)} />
      ) : (
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
        scope="app"
        appSlug={slug}
        dynamic={dynamicPalette}
        onPick={add}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}


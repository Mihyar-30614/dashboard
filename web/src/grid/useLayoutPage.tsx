import { useEffect, useRef, useState, type ReactNode } from "react";
import GridCanvas, { type GridWidget } from "./GridCanvas";
import WidgetFrame from "./WidgetFrame";
import { useLayout, useSaveLayout, useApps } from "../api/hooks";
import { WIDGETS } from "../widgets/registry";
import WidgetPalette, { type DynamicPaletteItem } from "./WidgetPalette";
import { useSqlWidgets, useSqlDataSources } from "../api/sqlWidgets";
import SaveBadge, { type SaveState } from "./SaveBadge";
import EmptyLayout from "./EmptyLayout";
import { setPageDirty } from "./savingRegistry";
import { ParamsEditingContext } from "./paramsEditing";
import { useToast } from "../ui/Toast";
import WidgetErrorBoundary from "./WidgetErrorBoundary";

export type LayoutPageScope = "overview" | "app";

export function sqlDefaultSize(viz?: string): { w: number; h: number } {
  if (viz === "line" || viz === "bar") return { w: 6, h: 4 };
  if (viz === "table") return { w: 6, h: 4 };
  return { w: 3, h: 2 };
}

export const PAGE_RANGES = ["7d", "30d", "90d"] as const;

export function effectiveParams(
  params: Record<string, unknown> | undefined,
  pageRange: string,
): Record<string, unknown> {
  const p = { ...(params ?? {}) };
  if (p.range == null || p.range === "") p.range = pageRange;
  return p;
}

type Options = {
  screen: string;
  dirtyKey: string;
  paletteScope: LayoutPageScope;
  appSlug?: string;
  defaultApp?: string;
};

export function useLayoutPage({
  screen,
  dirtyKey,
  paletteScope,
  appSlug,
  defaultApp,
}: Options) {
  const layoutQ = useLayout(screen);
  const apps = useApps();
  const save = useSaveLayout(screen);
  const sqlList = useSqlWidgets();
  const sqlSources = useSqlDataSources();
  const toast = useToast();
  const [local, setLocal] = useState<GridWidget[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pageRange, setPageRange] = useState<string>(() => {
    if (typeof window === "undefined") return "30d";
    const stored = window.localStorage.getItem(`range:${screen}`);
    return stored && (PAGE_RANGES as readonly string[]).includes(stored) ? stored : "30d";
  });
  useEffect(() => {
    window.localStorage.setItem(`range:${screen}`, pageRange);
  }, [pageRange, screen]);
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
    setPageDirty(dirtyKey, saveState === "dirty" || saveState === "saving");
    return () => setPageDirty(dirtyKey, false);
  }, [saveState, dirtyKey]);

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

  function updateParams(id: string, params: Record<string, unknown>) {
    const next = local.map((w) => (w.id === id ? { ...w, params } : w));
    setLocal(next);
    scheduleSave(next);
  }

  function add(kind: string) {
    const def = WIDGETS[kind];
    if (!def) return;
    const app =
      defaultApp ?? apps.data?.[0]?.slug ?? appSlug ?? undefined;
    const nextY = local.reduce((m, w) => Math.max(m, w.y + w.h), 0);
    const next = [
      ...local,
      {
        id: "w_" + Math.random().toString(36).slice(2, 8),
        kind,
        app,
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

  function addSql(widget: { id: number; viz?: string }) {
    const size = sqlDefaultSize(widget.viz);
    const nextY = local.reduce((m, w) => Math.max(m, w.y + w.h), 0);
    const next = [
      ...local,
      {
        id: "w_" + Math.random().toString(36).slice(2, 8),
        kind: "sql",
        app: appSlug,
        x: 0,
        y: nextY,
        w: size.w,
        h: size.h,
        params: { widget_id: widget.id, range: "30d" },
      },
    ];
    setLocal(next);
    scheduleSave(next);
  }

  const dynamicPalette: DynamicPaletteItem[] =
    paletteScope === "overview"
      ? (sqlList.data ?? [])
          .filter((w) => {
            const src = (sqlSources.data ?? []).find(
              (s) => s.name === w.data_source,
            );
            return src?.scope === "overview";
          })
          .map((w) => ({
            key: `sql:${w.id}`,
            label: w.name,
            description: w.description ?? "",
            defaultSize: sqlDefaultSize(w.viz),
            scope: "overview" as const,
            onPick: () => addSql(w),
          }))
      : (sqlList.data ?? []).map((w) => {
          const src = (sqlSources.data ?? []).find(
            (s) => s.name === w.data_source,
          );
          return {
            key: `sql:${w.id}`,
            label: w.name,
            description: w.description ?? "",
            defaultSize: sqlDefaultSize(w.viz),
            scope: (src?.scope ?? "app") as "app" | "overview",
            appSlug: src?.app_slug,
            onPick: () => addSql(w),
          };
        });

  function renderWidget(w: GridWidget): ReactNode {
    const def = WIDGETS[w.kind];
    if (!def) {
      return (
        <WidgetFrame title={w.kind} onRemove={() => remove(w.id)}>
          Unknown widget
        </WidgetFrame>
      );
    }
    const C = def.Component;
    return (
      <WidgetErrorBoundary
        key={w.id}
        kind={w.kind}
        onRemove={() => remove(w.id)}
      >
        <ParamsEditingContext.Provider
          value={{
            schema: def.paramsSchema,
            params: w.params ?? {},
            onSave: (params) => updateParams(w.id, params),
          }}
        >
          <C
            app={w.app}
            params={effectiveParams(w.params, pageRange)}
            onRemove={() => remove(w.id)}
          />
        </ParamsEditingContext.Provider>
      </WidgetErrorBoundary>
    );
  }

  const grid = layoutQ.data && local.length === 0 ? (
    <EmptyLayout scope={paletteScope} onAdd={() => setPaletteOpen(true)} />
  ) : (
    <GridCanvas widgets={local} onChange={onChange} renderWidget={renderWidget} />
  );

  const palette = (
    <WidgetPalette
      open={paletteOpen}
      scope={paletteScope}
      appSlug={appSlug}
      dynamic={dynamicPalette}
      onPick={add}
      onClose={() => setPaletteOpen(false)}
    />
  );

  const toolbar = (
    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
      <SaveBadge state={saveState} lastSavedAt={lastSavedAt} />
      <div
        role="group"
        aria-label="Time range"
        style={{ display: "inline-flex", gap: 2 }}
      >
        {PAGE_RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setPageRange(r)}
            aria-pressed={pageRange === r}
            style={{
              padding: "4px 8px",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              opacity: pageRange === r ? 1 : 0.5,
            }}
          >
            {r}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setPaletteOpen(true)}>
        + Add widget
      </button>
    </div>
  );

  return {
    apps,
    layoutQ,
    local,
    paletteOpen,
    setPaletteOpen,
    saveState,
    lastSavedAt,
    grid,
    palette,
    toolbar,
    onChange,
    remove,
    add,
    addSql,
    renderWidget,
  };
}

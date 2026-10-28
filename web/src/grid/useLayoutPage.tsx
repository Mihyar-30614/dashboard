import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
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
import { ExpandContext } from "./expandContext";
import { LayoutEditContext } from "./layoutEditContext";
import DrilldownModal from "./DrilldownModal";
import { useToast } from "../ui/Toast";
import WidgetErrorBoundary from "./WidgetErrorBoundary";
import ConfirmDialog from "../ui/ConfirmDialog";
import { bestFitLayout } from "./layoutMath";

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
  const [expanded, setExpanded] = useState<GridWidget | null>(null);
  const [layoutEditing, setLayoutEditing] = useState(false);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  /** Layout from before the last best fit, while it can still be undone. */
  const [fitUndo, setFitUndo] = useState<GridWidget[] | null>(null);
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
  const addWidgetBtnRef = useRef<HTMLButtonElement | null>(null);
  const editBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (layoutQ.data) {
      setLocal(layoutQ.data.layout);
      setSaveState("idle");
      if (layoutQ.data.updated_at)
        setLastSavedAt(new Date(layoutQ.data.updated_at));
    }
  }, [layoutQ.data]);

  useEffect(() => {
    if (!layoutEditing) setFitUndo(null);
  }, [layoutEditing]);

  useEffect(() => {
    setPageDirty(dirtyKey, saveState === "dirty" || saveState === "saving");
    return () => setPageDirty(dirtyKey, false);
  }, [saveState, dirtyKey]);

  // Accelerators: E edit · A add · 1/2/3 ranges (skip when typing in fields)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (paletteOpen || pendingRemoveId || expanded) return;
      const key = e.key.toLowerCase();
      if (key === "e") {
        e.preventDefault();
        setLayoutEditing((v) => !v);
        return;
      }
      if (key === "a") {
        e.preventDefault();
        setLayoutEditing(true);
        setPaletteOpen(true);
        return;
      }
      if (key === "1") {
        e.preventDefault();
        setPageRange("7d");
        return;
      }
      if (key === "2") {
        e.preventDefault();
        setPageRange("30d");
        return;
      }
      if (key === "3") {
        e.preventDefault();
        setPageRange("90d");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, pendingRemoveId, expanded]);

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
    if (!layoutEditing) return;
    setFitUndo(null);
    setLocal(next);
    scheduleSave(next);
  }

  function bestFit() {
    const next = bestFitLayout(local);
    setFitUndo(local);
    setLocal(next);
    scheduleSave(next);
  }

  function undoBestFit() {
    if (!fitUndo) return;
    setLocal(fitUndo);
    scheduleSave(fitUndo);
    setFitUndo(null);
  }

  function remove(id: string) {
    setFitUndo(null);
    const next = local.filter((w) => w.id !== id);
    setLocal(next);
    scheduleSave(next);
  }

  function requestRemove(id: string) {
    setPendingRemoveId(id);
  }

  function updateParams(id: string, params: Record<string, unknown>) {
    const next = local.map((w) => (w.id === id ? { ...w, params } : w));
    setLocal(next);
    scheduleSave(next);
  }

  function add(kind: string) {
    const def = WIDGETS[kind];
    if (!def) return;
    if (!layoutEditing) setLayoutEditing(true);
    setFitUndo(null);
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
    if (!layoutEditing) setLayoutEditing(true);
    setFitUndo(null);
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
        <WidgetFrame title={w.kind} onRemove={() => requestRemove(w.id)}>
          Unknown widget
        </WidgetFrame>
      );
    }
    const C = def.Component;
    return (
      <WidgetErrorBoundary
        key={w.id}
        kind={w.kind}
        onRemove={() => requestRemove(w.id)}
      >
        <ParamsEditingContext.Provider
          value={{
            schema: def.paramsSchema,
            params: w.params ?? {},
            onSave: (params) => updateParams(w.id, params),
          }}
        >
          <ExpandContext.Provider value={{ onExpand: () => setExpanded(w) }}>
            <C
              app={w.app}
              params={effectiveParams(w.params, pageRange)}
              onRemove={() => requestRemove(w.id)}
            />
          </ExpandContext.Provider>
        </ParamsEditingContext.Provider>
      </WidgetErrorBoundary>
    );
  }

  const pendingWidget = pendingRemoveId
    ? local.find((w) => w.id === pendingRemoveId)
    : null;

  const grid = (
    <LayoutEditContext.Provider value={{ editing: layoutEditing }}>
      {layoutQ.isLoading ? (
        <div
          className="panel"
          style={{
            padding: 28,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Loading layout…
        </div>
      ) : layoutQ.isError ? (
        <div
          className="panel"
          style={{
            padding: 28,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--bad)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Could not load layout
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", maxWidth: 420 }}>
            {(layoutQ.error as Error)?.message ||
              "Check the API connection, then try again."}
          </p>
          <button type="button" onClick={() => layoutQ.refetch()}>
            Retry
          </button>
        </div>
      ) : layoutQ.data && local.length === 0 ? (
        <EmptyLayout
          scope={paletteScope}
          onAdd={() => {
            setLayoutEditing(true);
            setPaletteOpen(true);
          }}
        />
      ) : (
        <GridCanvas
          widgets={local}
          onChange={onChange}
          renderWidget={renderWidget}
          editable={layoutEditing}
        />
      )}
      {expanded && (
        <DrilldownModal
          widget={expanded}
          pageRange={pageRange}
          onClose={() => setExpanded(null)}
        />
      )}
      <ConfirmDialog
        open={pendingRemoveId != null}
        title="Remove widget"
        message={
          pendingWidget
            ? `Remove this ${pendingWidget.kind.replace(/_/g, " ")} widget from the board? The layout saves automatically after removal.`
            : "Remove this widget from the board? The layout saves automatically after removal."
        }
        confirmLabel="Remove widget"
        danger
        onConfirm={() => {
          if (pendingRemoveId) remove(pendingRemoveId);
          setPendingRemoveId(null);
        }}
        onCancel={() => setPendingRemoveId(null)}
      />
    </LayoutEditContext.Provider>
  );

  const palette = (
    <WidgetPalette
      open={paletteOpen}
      scope={paletteScope}
      appSlug={appSlug}
      dynamic={dynamicPalette}
      onPick={add}
      onClose={() => setPaletteOpen(false)}
      returnFocusRef={addWidgetBtnRef as RefObject<HTMLElement | null>}
    />
  );

  const rangeHints: Record<(typeof PAGE_RANGES)[number], string> = {
    "7d": "1",
    "30d": "2",
    "90d": "3",
  };

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
            title={`Range ${r} (${rangeHints[r]})`}
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
      <button
        ref={editBtnRef}
        type="button"
        onClick={() => setLayoutEditing((e) => !e)}
        aria-pressed={layoutEditing}
        title={
          layoutEditing
            ? "Done editing — hide drag, resize, and remove (E)"
            : "Edit layout — drag, resize, and remove widgets (E)"
        }
      >
        {layoutEditing ? "Done editing" : "Edit layout"}
      </button>
      {layoutEditing && (
        <button
          ref={addWidgetBtnRef}
          type="button"
          onClick={() => setPaletteOpen(true)}
          title="Add widget (A)"
        >
          + Add widget
        </button>
      )}
      {layoutEditing && local.length > 0 &&
        (fitUndo ? (
          <button
            type="button"
            onClick={undoBestFit}
            title="Restore the layout from before best fit"
          >
            Undo best fit
          </button>
        ) : (
          <button
            type="button"
            onClick={bestFit}
            title="Re-arrange widgets into full-width rows with no gaps"
          >
            Best fit
          </button>
        ))}
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
    layoutEditing,
    setLayoutEditing,
    grid,
    palette,
    toolbar,
    onChange,
    remove,
    add,
    addSql,
    bestFit,
    renderWidget,
  };
}

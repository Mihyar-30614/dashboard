import { useEffect, useRef } from "react";
import { GridStack, type GridStackNode, type Responsive } from "gridstack";
import "gridstack/dist/gridstack.min.css";
import "gridstack/dist/gridstack-extra.css";

export type GridWidget = {
  id: string;
  kind: string;
  app?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  params: Record<string, unknown>;
};

/**
 * Scale/stack when the canvas is narrow, then restore the cached 12-col layout
 * on the way back up. `list`/`compact` must not be used here — they only restore
 * `w` and re-pack, so the original x/y are lost after a resize cycle.
 */
const RESPONSIVE_COLUMNS: Responsive = {
  columnMax: 12,
  layout: "moveScale",
  breakpoints: [
    // 12→2: w=4 becomes w=1 → two-across; 12→1: full stack. Cache restores both.
    { w: 900, c: 2 },
    { w: 560, c: 1 },
  ],
};

type Props = {
  widgets: GridWidget[];
  onChange: (widgets: GridWidget[]) => void;
  renderWidget: (w: GridWidget) => React.ReactNode;
  /** When false, drag/resize are locked for scan-first viewing. */
  editable?: boolean;
};

export default function GridCanvas({
  widgets,
  onChange,
  renderWidget,
  editable = true,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<GridStack | null>(null);
  const widgetsRef = useRef<GridWidget[]>(widgets);
  const internalChangeRef = useRef(false);

  // keep ref fresh
  useEffect(() => {
    widgetsRef.current = widgets;
  }, [widgets]);

  // init once
  useEffect(() => {
    if (!rootRef.current || gridRef.current) return;
    gridRef.current = GridStack.init(
      {
        column: 12,
        cellHeight: 70,
        margin: 10,
        float: true,
        animate: true,
        handle: ".widget-drag-handle",
        resizable: { handles: "se,e,s" },
        staticGrid: !editable,
        // Edit mode locks to 12-col so drag/save coords stay canonical.
        columnOpts: editable ? undefined : RESPONSIVE_COLUMNS,
      },
      rootRef.current,
    );
    gridRef.current.on("change", () => {
      if (internalChangeRef.current) return;
      const grid = gridRef.current;
      if (!grid || grid.isIgnoreChangeCB()) return;
      const nodes = grid.engine.nodes as GridStackNode[];
      const next: GridWidget[] = nodes.map((n) => {
        const orig =
          widgetsRef.current.find((w) => w.id === n.id) ||
          ({ params: {} } as any);
        return {
          ...orig,
          id: n.id as string,
          x: n.x!,
          y: n.y!,
          w: n.w!,
          h: n.h!,
        };
      });
      onChange(next);
    });
    return () => {
      gridRef.current?.destroy(false);
      gridRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.setStatic(!editable);
    // Editing: pin 12-col canonical layout. Viewing: reflow by canvas width.
    if (editable) {
      grid.opts.columnOpts = undefined;
      if (grid.getColumn() !== 12) grid.column(12);
    } else {
      grid.opts.columnOpts = RESPONSIVE_COLUMNS;
      grid.onResize();
    }
  }, [editable]);

  // Keep column geometry in sync when the shell width changes (sidebar / window).
  useEffect(() => {
    const grid = gridRef.current;
    const root = rootRef.current;
    if (!grid || !root) return;
    const onWin = () => {
      grid.onResize(root.clientWidth);
    };
    window.addEventListener("resize", onWin);
    const ro = new ResizeObserver(() => onWin());
    ro.observe(root);
    return () => {
      window.removeEventListener("resize", onWin);
      ro.disconnect();
    };
  }, []);

  // sync widget set into gridstack when ids change
  const idsKey = widgets.map((w) => w.id).join("|");
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    internalChangeRef.current = true;
    grid.batchUpdate();
    const existingNodes = grid.engine.nodes.slice();
    const incomingIds = new Set(widgets.map((w) => w.id));
    // remove orphans
    for (const n of existingNodes) {
      if (!incomingIds.has(n.id as string)) {
        if (n.el) grid.removeWidget(n.el, false);
      }
    }
    // add new
    const haveIds = new Set(
      grid.engine.nodes.map((n) => n.id as string),
    );
    for (const w of widgets) {
      if (haveIds.has(w.id)) continue;
      const el = rootRef.current?.querySelector(
        `.grid-stack-item[gs-id="${w.id}"]`,
      ) as HTMLElement | null;
      if (el) grid.makeWidget(el);
    }
    grid.batchUpdate(false);
    queueMicrotask(() => {
      internalChangeRef.current = false;
    });
  }, [idsKey]);

  return (
    <div className="grid-stack" ref={rootRef}>
      {widgets.map((w) => (
        <div
          className="grid-stack-item"
          key={w.id}
          gs-id={w.id}
          gs-x={w.x}
          gs-y={w.y}
          gs-w={w.w}
          gs-h={w.h}
        >
          <div className="grid-stack-item-content">{renderWidget(w)}</div>
        </div>
      ))}
    </div>
  );
}

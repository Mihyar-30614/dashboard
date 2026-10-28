import { useEffect, useRef } from "react";
import { GridStack, type GridStackNode } from "gridstack";
import "gridstack/dist/gridstack.min.css";
import "gridstack/dist/gridstack-extra.css";
import { MAX_COLUMNS, columnsForWidth, layoutForColumns } from "./layoutMath";

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
  const onChangeRef = useRef(onChange);
  const editableRef = useRef(editable);
  const internalChangeRef = useRef(false);
  /** True mid drag/resize, when the engine is ahead of `widgets`. */
  const interactingRef = useRef(false);

  // keep refs fresh — the GridStack change handler is bound once at init
  widgetsRef.current = widgets;
  onChangeRef.current = onChange;
  editableRef.current = editable;

  /**
   * Lay the grid out for the current canvas width. GridStack's own responsive
   * mode (`columnOpts` + `moveScale`) rounds x/w per item, which collides and
   * reorders widgets, and its column cache goes stale once the layout is
   * edited. Instead every column count is derived from the saved 12-column
   * layout (see layoutMath) and pushed in with `load()`. Editing always pins
   * 12 columns so drag/save coords stay canonical.
   */
  function sync() {
    const grid = gridRef.current;
    const root = rootRef.current;
    if (!grid || !root || interactingRef.current) return;
    const column = editableRef.current
      ? MAX_COLUMNS
      : columnsForWidth(root.clientWidth || window.innerWidth);
    const target = layoutForColumns(
      widgetsRef.current.map(({ id, x, y, w, h }) => ({ id, x, y, w, h })),
      column,
    );
    const current = new Map(
      grid.engine.nodes.map((n) => [n.id as string, n]),
    );
    const settled =
      grid.getColumn() === column &&
      target.every((t) => {
        const n = current.get(t.id);
        return !n || (n.x === t.x && n.y === t.y && n.w === t.w && n.h === t.h);
      });
    if (settled) return;
    internalChangeRef.current = true;
    grid.batchUpdate();
    if (grid.getColumn() !== column) {
      // Drop GridStack's cached per-column layouts; ours are derived instead.
      grid.engine.cacheLayout([], MAX_COLUMNS, true);
      grid.column(column, "none");
    }
    grid.load(
      target.filter((t) => current.has(t.id)),
      false,
    );
    grid.batchUpdate(false);
    queueMicrotask(() => {
      internalChangeRef.current = false;
    });
  }

  // init once
  useEffect(() => {
    if (!rootRef.current || gridRef.current) return;
    const grid = GridStack.init(
      {
        column: MAX_COLUMNS,
        cellHeight: 70,
        margin: 10,
        float: true,
        animate: true,
        handle: ".widget-drag-handle",
        resizable: { handles: "se,e,s" },
        staticGrid: !editable,
      },
      rootRef.current,
    );
    gridRef.current = grid;
    grid.on("dragstart resizestart", () => {
      interactingRef.current = true;
    });
    grid.on("dragstop resizestop", () => {
      interactingRef.current = false;
    });
    grid.on("change", () => {
      if (internalChangeRef.current || grid.isIgnoreChangeCB()) return;
      // Only the canonical 12-column layout is ever saved.
      if (!editableRef.current || grid.getColumn() !== MAX_COLUMNS) return;
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
      widgetsRef.current = next;
      onChangeRef.current(next);
    });
    // First paint at the right column count, without animating into it.
    grid.setAnimation(false);
    sync();
    grid.setAnimation(true, true);
    return () => {
      gridRef.current?.destroy(false);
      gridRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    gridRef.current?.setStatic(!editable);
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable]);

  // Re-derive the layout when the shell width changes (sidebar / window).
  // Height changes are ignored: the grid grows while items are dragged.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let lastWidth = root.clientWidth;
    const onResize = () => {
      if (root.clientWidth === lastWidth) return;
      lastWidth = root.clientWidth;
      sync();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(root);
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Positions set from outside (best fit, undo, add/remove) → push into the grid.
  const posKey = widgets.map((w) => `${w.id}:${w.x},${w.y},${w.w},${w.h}`).join("|");
  useEffect(() => {
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posKey, idsKey]);

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

import { useEffect, useRef } from "react";
import { GridStack, type GridStackNode } from "gridstack";
import "gridstack/dist/gridstack.min.css";

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
};

export default function GridCanvas({ widgets, onChange, renderWidget }: Props) {
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
      },
      rootRef.current,
    );
    gridRef.current.on("change", () => {
      if (internalChangeRef.current) return;
      const nodes = gridRef.current!.engine.nodes as GridStackNode[];
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

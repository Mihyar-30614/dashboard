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
  editing: boolean;
  onChange: (widgets: GridWidget[]) => void;
  renderWidget: (w: GridWidget) => React.ReactNode;
};

export default function GridCanvas({
  widgets,
  editing,
  onChange,
  renderWidget,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<GridStack | null>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    gridRef.current = GridStack.init(
      {
        column: 12,
        cellHeight: 60,
        margin: 8,
        disableResize: !editing,
        disableDrag: !editing,
        float: false,
      },
      rootRef.current,
    );
    const sync = () => {
      const nodes = gridRef.current!.engine.nodes as GridStackNode[];
      const next: GridWidget[] = nodes.map((n) => {
        const orig =
          widgets.find((w) => w.id === n.id) || ({ params: {} } as any);
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
    };
    gridRef.current.on("change", sync);
    return () => {
      gridRef.current?.destroy(false);
      gridRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!gridRef.current) return;
    if (editing) {
      gridRef.current.enableMove(true);
      gridRef.current.enableResize(true);
    } else {
      gridRef.current.enableMove(false);
      gridRef.current.enableResize(false);
    }
  }, [editing]);

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

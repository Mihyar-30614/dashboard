import { useEffect, useState } from "react";
import GridCanvas, { type GridWidget } from "../grid/GridCanvas";
import WidgetFrame from "../grid/WidgetFrame";
import { useLayout, useSaveLayout, useApps } from "../api/hooks";
import { WIDGETS } from "../widgets/registry";
import EditModeBar from "../grid/EditModeBar";
import WidgetPalette from "../grid/WidgetPalette";

export default function Overview() {
  const layoutQ = useLayout("overview");
  const apps = useApps();
  const save = useSaveLayout("overview");
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState<GridWidget[]>([]);
  const [dirty, setDirty] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (layoutQ.data) {
      setLocal(layoutQ.data.layout);
      setDirty(false);
    }
  }, [layoutQ.data]);

  function remove(id: string) {
    setLocal((arr) => arr.filter((w) => w.id !== id));
    setDirty(true);
  }
  function add(kind: string) {
    const def = WIDGETS[kind];
    if (!def) return;
    const firstApp = (apps.data as any)?.[0]?.slug;
    setLocal((arr) => [
      ...arr,
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
    ]);
    setDirty(true);
  }

  return (
    <div>
      <h2 style={{ margin: "0 0 8px" }}>Overview</h2>
      <EditModeBar
        editing={editing}
        dirty={dirty}
        saving={save.isPending}
        onEdit={() => setEditing(true)}
        onSave={async () => {
          await save.mutateAsync(local);
          setDirty(false);
          setEditing(false);
        }}
        onCancel={() => {
          setLocal(layoutQ.data?.layout || []);
          setDirty(false);
          setEditing(false);
        }}
        onAdd={() => setPaletteOpen(true)}
      />
      <GridCanvas
        widgets={local}
        editing={editing}
        onChange={(next) => {
          setLocal(next);
          setDirty(true);
        }}
        renderWidget={(w) => {
          const def = WIDGETS[w.kind];
          if (!def)
            return (
              <WidgetFrame
                title={w.kind}
                editing={editing}
                onRemove={() => remove(w.id)}
              >
                Unknown
              </WidgetFrame>
            );
          const C = def.Component;
          return (
            <C
              app={w.app}
              params={w.params}
              editing={editing}
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

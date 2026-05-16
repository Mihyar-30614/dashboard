import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import GridCanvas, { type GridWidget } from "../grid/GridCanvas";
import WidgetFrame from "../grid/WidgetFrame";
import { useLayout, useSaveLayout, useApps } from "../api/hooks";
import { WIDGETS } from "../widgets/registry";
import EditModeBar from "../grid/EditModeBar";
import WidgetPalette from "../grid/WidgetPalette";

export default function AppPage() {
  const { slug = "" } = useParams();
  const layoutQ = useLayout(slug);
  const apps = useApps();
  const save = useSaveLayout(slug);
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

  const meta = (apps.data as any[])?.find((a) => a.slug === slug);

  function remove(id: string) {
    setLocal((arr) => arr.filter((w) => w.id !== id));
    setDirty(true);
  }
  function add(kind: string) {
    const def = WIDGETS[kind];
    if (!def) return;
    setLocal((arr) => [
      ...arr,
      {
        id: "w_" + Math.random().toString(36).slice(2, 8),
        kind,
        app: slug,
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
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
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
                <span>
                  · health: {meta.health?.ok ? "up" : "down"}
                </span>
              </>
            )}
          </div>
        </div>
      </header>

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
                Unknown widget
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
        scope="app"
        onPick={add}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}

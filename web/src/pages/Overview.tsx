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

  const list = (apps.data as any[]) || [];
  const onlineCount = list.filter((a) => a.pm2_status === "online").length;
  const upCount = list.filter((a) => a.health?.ok).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
        <div>
          <span className="eyebrow">overview · all properties</span>
          <h1 style={{ marginTop: 6 }}>
            <em
              style={{
                fontStyle: "italic",
                color: "var(--accent)",
                fontWeight: 500,
              }}
            >
              Three
            </em>{" "}
            applications,
            <br />
            one pane of glass.
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

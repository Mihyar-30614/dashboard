import { useLayoutPage } from "../grid/useLayoutPage";

export default function Overview() {
  const { apps, grid, palette, toolbar } = useLayoutPage({
    screen: "overview",
    dirtyKey: "overview",
    paletteScope: "overview",
  });

  const list = apps.data ?? [];
  const onlineCount = list.filter((a) => a.pm2_status === "online").length;
  const upCount = list.filter((a) => a.health?.ok).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
        <div>
          <span className="eyebrow">overview · all properties</span>
          <h1 style={{ marginTop: 6 }}>
            Every property,
            <br />
            <em
              style={{
                fontStyle: "italic",
                color: "var(--accent)",
                fontWeight: 500,
              }}
            >
              one
            </em>{" "}
            pane of glass.
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
            borderRadius: "var(--radius)",
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

      {toolbar}
      {grid}
      {palette}
    </div>
  );
}

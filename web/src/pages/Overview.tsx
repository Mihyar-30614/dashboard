import PageHeader from "../ui/PageHeader";
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
      <PageHeader
        eyebrow="overview · all properties"
        title="Overview"
        stats={[
          { k: "Apps", v: list.length || "—" },
          { k: "Online", v: list.length ? `${onlineCount}/${list.length}` : "—" },
          { k: "Healthy", v: list.length ? `${upCount}/${list.length}` : "—" },
        ]}
        actions={toolbar}
      />

      {grid}
      {palette}
    </div>
  );
}

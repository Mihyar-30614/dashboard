import PageHeader from "../ui/PageHeader";
import { useLayoutPage } from "../grid/useLayoutPage";

export default function Overview() {
  const { apps, grid, palette, toolbar } = useLayoutPage({
    screen: "overview",
    dirtyKey: "overview",
    paletteScope: "overview",
  });

  const list = apps.data ?? [];
  const total = list.length;
  const onlineCount = list.filter((a) => a.pm2_status === "online").length;
  const upCount = list.filter((a) => a.health?.ok).length;

  const onlineTone =
    total === 0 ? undefined : onlineCount === total ? "ok" : onlineCount === 0 ? "bad" : "warn";
  const healthTone =
    total === 0 ? undefined : upCount === total ? "ok" : upCount === 0 ? "bad" : "warn";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        eyebrow="overview · all properties"
        title="Overview"
        stats={[
          { k: "apps", v: total || "—" },
          {
            k: "online",
            v: total ? `${onlineCount}/${total}` : "—",
            tone: onlineTone,
          },
          {
            k: "healthy",
            v: total ? `${upCount}/${total}` : "—",
            tone: healthTone,
          },
        ]}
        actions={toolbar}
      />

      {grid}
      {palette}
    </div>
  );
}

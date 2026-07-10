import { useParams } from "react-router-dom";
import { useLayoutPage } from "../grid/useLayoutPage";
import PageHeader from "../ui/PageHeader";

export default function AppPage() {
  const { slug = "" } = useParams();
  const { apps, grid, palette, toolbar } = useLayoutPage({
    screen: slug,
    dirtyKey: `app:${slug}`,
    paletteScope: "app",
    appSlug: slug,
    defaultApp: slug,
  });

  const meta = apps.data?.find((a) => a.slug === slug);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader
        eyebrow="property"
        title={meta?.label || slug}
        meta={
          meta ? (
            <>
              <span>slug: {slug}</span>
              <span>· pm2: {meta.pm2_status}</span>
              <span>· health: {meta.health?.ok ? "up" : "down"}</span>
            </>
          ) : (
            <span>slug: {slug}</span>
          )
        }
        actions={toolbar}
      />

      {grid}
      {palette}
    </div>
  );
}

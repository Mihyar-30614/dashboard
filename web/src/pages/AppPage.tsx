import { useParams } from "react-router-dom";
import { useLayoutPage } from "../grid/useLayoutPage";

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
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 18,
        }}
      >
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
                <span>· health: {meta.health?.ok ? "up" : "down"}</span>
              </>
            )}
          </div>
        </div>
        {toolbar}
      </header>

      {grid}
      {palette}
    </div>
  );
}

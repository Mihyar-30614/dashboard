import type { ReactNode } from "react";

export type PageHeaderProps = {
  eyebrow: string;
  title: string;
  meta?: ReactNode;
  stats?: { k: string; v: string | number }[];
  actions?: ReactNode;
};

export default function PageHeader({ eyebrow, title, meta, stats, actions }: PageHeaderProps) {
  return (
    <header
      data-testid="page-header"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 20,
        marginBottom: 20,
      }}
    >
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2 style={{ marginTop: 6, marginBottom: 0 }}>{title}</h2>
        {meta && (
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
            {meta}
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {stats && stats.length > 0 && (
          <div
            style={{
              display: "grid",
              gridAutoFlow: "column",
              gap: 18,
              padding: "10px 16px",
              border: "1px solid var(--rule)",
              borderRadius: "var(--radius)",
              background: "var(--panel)",
            }}
          >
            {stats.map((s) => (
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
        )}
        {actions}
      </div>
    </header>
  );
}

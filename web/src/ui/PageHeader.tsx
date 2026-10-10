import type { ReactNode } from "react";

export type PageHeaderProps = {
  /** Optional mono eyebrow; omit when the title alone carries the section. */
  eyebrow?: string;
  title: string;
  meta?: ReactNode;
  /** Contextual counts — rendered as inline metadata, not KPI-style metrics. */
  stats?: { k: string; v: string | number; tone?: "ok" | "warn" | "bad" }[];
  actions?: ReactNode;
};

function PageHeaderSummary({
  stats,
}: {
  stats: NonNullable<PageHeaderProps["stats"]>;
}) {
  return (
    <p className="page-header__summary" data-testid="page-header-summary">
      {stats.map((s, i) => (
        <span key={s.k}>
          {i > 0 && <span className="page-header__summary-sep">·</span>}
          <span className={s.tone ? `page-header__summary--${s.tone}` : undefined}>
            {s.v} {s.k.toLowerCase()}
          </span>
        </span>
      ))}
    </p>
  );
}

export default function PageHeader({ eyebrow, title, meta, stats, actions }: PageHeaderProps) {
  return (
    <header
      data-testid="page-header"
      className="page-header"
    >
      <div className="page-header__main">
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h2 style={{ marginTop: eyebrow ? 6 : 0, marginBottom: 0 }}>{title}</h2>
        {stats && stats.length > 0 && <PageHeaderSummary stats={stats} />}
        {meta && <div className="page-header__meta">{meta}</div>}
      </div>

      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

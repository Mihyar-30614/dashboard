import {
  BarList,
  Empty,
  Hero,
  InsightFrame,
  Pill,
  SeriesChart,
  Stats,
  dayLabel,
  dollars,
  useInsight,
  type WidgetProps,
} from "./parts";

const APP = "honeydoeh";

type Spend = {
  currency: string;
  mtd: number;
  last_month_same_day: number;
  last_month: number;
  avg_3m: number;
  items_mtd: number;
  categories: { category: string; mtd: number; avg_3m: number }[];
};

export function HdSpend({ onRemove }: WidgetProps) {
  const { data: d, error, loading } = useInsight<Spend>("hd_spend", { app: APP });
  const c = d?.currency;
  const vsLast = d ? d.mtd - d.last_month_same_day : 0;
  return (
    <InsightFrame title="Spend this month" meta="shopping lists" loading={loading} error={error} onRemove={onRemove}>
      {d && (
        <div className="ins-stack">
          <Hero
            value={dollars(d.mtd, c)}
            label={
              <>
                {d.items_mtd} items ·{" "}
                <Pill tone={vsLast > 0 ? "bad" : "ok"}>{dollars(vsLast, c, { sign: true })} vs this point last month</Pill>
              </>
            }
          />
          <Stats
            items={[
              { label: "last month", value: dollars(d.last_month, c) },
              { label: "3-month avg", value: dollars(d.avg_3m, c) },
            ]}
          />
          {d.categories.length ? (
            <BarList
              rows={d.categories.slice(0, 6).map((x) => ({
                key: x.category,
                label: x.category,
                value: x.mtd,
                display: dollars(x.mtd, c),
                sub: `usually ${dollars(x.avg_3m, c)} a month`,
                tone: x.mtd > x.avg_3m * 1.15 ? "warn" : "accent",
              }))}
            />
          ) : (
            <Empty>Nothing bought this month yet.</Empty>
          )}
        </div>
      )}
    </InsightFrame>
  );
}

type Creep = {
  currency: string;
  tracked: number;
  items: {
    name: string;
    first_price: number;
    last_price: number;
    first_at: string;
    last_at: string;
    times: number;
    change_pct: number;
  }[];
};

export function HdPriceCreep({ onRemove }: WidgetProps) {
  const { data: d, error, loading } = useInsight<Creep>("hd_price_creep", { app: APP });
  const c = d?.currency;
  const up = d?.items.filter((i) => i.change_pct > 0) ?? [];
  const down = d?.items.filter((i) => i.change_pct < 0) ?? [];
  return (
    <InsightFrame
      title="Price creep"
      meta={d ? `${d.tracked} items bought 4+ times · first two buys vs last two` : undefined}
      loading={loading}
      error={error}
      onRemove={onRemove}
    >
      {d &&
        (d.items.length ? (
          <div className="ins-stack">
            <Stats
              items={[
                { label: "got pricier", value: up.length, tone: up.length ? "bad" : undefined },
                { label: "got cheaper", value: down.length, tone: down.length ? "ok" : undefined },
              ]}
            />
            <ul className="ins-list">
              {d.items.slice(0, 6).map((i) => (
                <li key={i.name} className="ins-list__row">
                  <div>
                    <div className="ins-list__title">{i.name}</div>
                    <div className="ins-list__sub">
                      {dollars(i.first_price, c)} → {dollars(i.last_price, c)} · {i.times}× since {dayLabel(i.first_at)}
                    </div>
                  </div>
                  <Pill tone={i.change_pct > 0 ? "bad" : "ok"}>
                    {i.change_pct > 0 ? "+" : ""}
                    {i.change_pct.toFixed(0)}%
                  </Pill>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Empty>No price changes on items you buy often.</Empty>
        ))}
    </InsightFrame>
  );
}

type TodoFlow = {
  open: number;
  overdue: number;
  due_week: number;
  open_high: number;
  median_days: number | null;
  weeks: { week: string; created: number; completed: number }[];
};

function days(n: number | null) {
  if (n == null) return "—";
  if (n < 1) return `${Math.max(1, Math.round(n * 24))}h`;
  return `${n.toFixed(n < 10 ? 1 : 0)}d`;
}

export function HdTodoFlow({ onRemove }: WidgetProps) {
  const { data: d, error, loading } = useInsight<TodoFlow>("hd_todo_flow", { app: APP });
  return (
    <InsightFrame title="Todo flow" meta="last 8 weeks" loading={loading} error={error} onRemove={onRemove}>
      {d && (
        <div className="ins-stack ins-stack--fill">
          <Stats
            items={[
              { label: "open", value: d.open },
              { label: "overdue", value: d.overdue, tone: d.overdue ? "bad" : "ok" },
              { label: "due this week", value: d.due_week, tone: d.due_week ? "warn" : undefined },
              { label: "high priority", value: d.open_high, tone: d.open_high ? "warn" : undefined },
              { label: "median to done", value: days(d.median_days), hint: "completed in the last 90 days" },
            ]}
          />
          <SeriesChart
            data={d.weeks}
            xKey="week"
            xFormat={dayLabel}
            yFormat={(v) => String(v)}
            series={[
              { key: "created", label: "Added", color: "var(--chart-6)", kind: "bar" },
              { key: "completed", label: "Done", color: "var(--chart-2)", kind: "bar" },
            ]}
          />
        </div>
      )}
    </InsightFrame>
  );
}

import { Link } from "react-router-dom";
import { useApps } from "../api/hooks";
import {
  Empty,
  Hero,
  InsightFrame,
  Note,
  Pill,
  Stats,
  dollars,
  money,
  monthLabel,
  pct,
  useInsight,
  type Tone,
  type WidgetProps,
} from "./parts";

function useAppLabel() {
  const apps = useApps();
  const list = (apps.data as { slug: string; label?: string }[] | undefined) ?? [];
  return (slug: string) => list.find((a) => a.slug === slug)?.label ?? slug;
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const w = 72;
  const h = 18;
  const step = w / values.length;
  return (
    <svg className="ov-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      {values.map((v, i) => (
        <rect
          key={i}
          x={i * step + 1}
          y={h - Math.max(1, (v / max) * h)}
          width={step - 2}
          height={Math.max(1, (v / max) * h)}
          rx={1}
        />
      ))}
    </svg>
  );
}

type Fleet = {
  apps: {
    slug: string;
    label: string;
    health: { ok: boolean; latency_ms?: number; error?: string };
    pm2: string;
    http: { per_min?: number; errors_5xx?: number; count?: number; buckets?: number[]; error?: string };
    uptime_7d: number | null;
  }[];
};

export function OvFleet({ onRemove }: WidgetProps) {
  const { data: d, error, loading } = useInsight<Fleet>("ov_fleet", {});
  return (
    <InsightFrame title="Fleet" meta="live · last hour" loading={loading} error={error} onRemove={onRemove}>
      {d && (
        <div className="ov-fleet" role="table" aria-label="App status">
          <div className="ov-fleet__row ov-fleet__row--head" role="row">
            <span role="columnheader">app</span>
            <span role="columnheader">health</span>
            <span role="columnheader">process</span>
            <span role="columnheader">req / min</span>
            <span role="columnheader" className="ov-fleet__spark-col">last hour</span>
            <span role="columnheader">5xx 1h</span>
            <span role="columnheader">uptime 7d</span>
          </div>
          {d.apps.map((a) => {
            const upTone: Tone = a.uptime_7d == null ? "muted" : a.uptime_7d >= 0.999 ? "ok" : a.uptime_7d >= 0.99 ? "warn" : "bad";
            return (
              <div key={a.slug} className="ov-fleet__row" role="row">
                <Link to={`/app/${a.slug}`} className="ov-fleet__app" role="cell">
                  {a.label}
                </Link>
                <span role="cell" className="ov-fleet__health">
                  <span className={`led ${a.health.ok ? "led--ok" : "led--bad"}`} />
                  <span className={`metric ins-tone--${a.health.ok ? "ok" : "bad"}`}>{a.health.ok ? "up" : "down"}</span>
                  {a.health.latency_ms != null && <span className="ov-fleet__sub">{a.health.latency_ms}ms</span>}
                </span>
                <span role="cell" className={`metric ins-tone--${a.pm2 === "online" ? "ok" : "bad"}`}>{a.pm2}</span>
                <span role="cell" className="metric" title={a.http.error}>
                  {a.http.error ? "—" : a.http.per_min}
                </span>
                <span role="cell" className="ov-fleet__spark-col">
                  {a.http.buckets && <Sparkline values={a.http.buckets} />}
                </span>
                <span role="cell" className={`metric ${a.http.error ? "" : a.http.errors_5xx ? "ins-tone--bad" : "ins-tone--ok"}`}>
                  {a.http.error ? "—" : a.http.errors_5xx}
                </span>
                <span role="cell" className={`metric ins-tone--${upTone}`}>
                  {a.uptime_7d == null ? "—" : pct(a.uptime_7d * 100, 2)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </InsightFrame>
  );
}

type Attention = {
  items: {
    app: string;
    severity: "bad" | "warn";
    text: string;
    detail: string | null;
    amount: { cents: number; currency: string } | null;
  }[];
};

export function OvAttention({ onRemove }: WidgetProps) {
  const { data: d, error, loading } = useInsight<Attention>("ov_attention", {});
  const label = useAppLabel();
  return (
    <InsightFrame title="Needs attention" meta="across all apps" loading={loading} error={error} onRemove={onRemove}>
      {d &&
        (d.items.length ? (
          <ul className="ins-list">
            {d.items.map((i, n) => (
              <li key={n} className="ins-list__row">
                <Link to={`/app/${i.app}`} className="ov-item">
                  <span className={`led ${i.severity === "bad" ? "led--bad" : "led--warn"}`} />
                  <span>
                    <span className="ins-list__title">{i.text}</span>
                    <span className="ins-list__sub ov-item__sub">{i.detail ?? label(i.app)}</span>
                  </span>
                </Link>
                {i.amount && <span className="metric">{money(i.amount.cents, i.amount.currency)}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <Hero value="All clear" tone="ok" label="nothing waiting on you in any app" />
        ))}
    </InsightFrame>
  );
}

type Week = {
  events: {
    app: string;
    kind: "game" | "bill" | "todo";
    at: string;
    all_day?: boolean;
    title: string;
    detail: string | null;
    amount?: { cents: number; currency: string };
    done?: boolean;
  }[];
};

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayHeading(d: Date) {
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (dayKey(d) === dayKey(today)) return "Today";
  if (dayKey(d) === dayKey(tomorrow)) return "Tomorrow";
  return d.toLocaleDateString("en-CA", { weekday: "long", month: "short", day: "numeric" });
}

const KIND_TONE: Record<string, Tone> = { game: "accent", bill: "warn", todo: "muted" };

export function OvWeek({ onRemove }: WidgetProps) {
  const { data: d, error, loading } = useInsight<Week>("ov_week", {});
  const label = useAppLabel();
  const days: { key: string; heading: string; events: Week["events"] }[] = [];
  for (const e of d?.events ?? []) {
    const at = new Date(e.at);
    const key = dayKey(at);
    let day = days.find((x) => x.key === key);
    if (!day) days.push((day = { key, heading: dayHeading(at), events: [] }));
    day.events.push(e);
  }
  return (
    <InsightFrame title="Next 7 days" meta="games · bills · todos" loading={loading} error={error} onRemove={onRemove}>
      {d &&
        (days.length ? (
          <div className="ov-week">
            {days.map((day) => (
              <section key={day.key} className="ov-week__day">
                <h4 className="ov-week__heading">{day.heading}</h4>
                <ul className="ins-list">
                  {day.events.map((e, n) => (
                    <li key={n} className={`ins-list__row${e.done ? " ov-week__done" : ""}`}>
                      <span className="ov-week__time">
                        {e.all_day
                          ? "due"
                          : new Date(e.at).toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" })}
                      </span>
                      <span className="ov-week__body">
                        <span className="ins-list__title">{e.title}</span>
                        <span className="ins-list__sub">
                          {label(e.app)}
                          {e.detail ? ` · ${e.detail}` : ""}
                        </span>
                      </span>
                      <span className="ins-list__end">
                        {e.amount && <span className="metric">{money(e.amount.cents, e.amount.currency)}</span>}
                        <Pill tone={e.done ? "ok" : KIND_TONE[e.kind]}>{e.done ? "covered" : e.kind}</Pill>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <Empty>Nothing scheduled in the next 7 days.</Empty>
        ))}
    </InsightFrame>
  );
}

type Pulse =
  | {
      slug: "sportly";
      wallets_cents: number;
      new_players_7d: number;
      comeback_pct: number | null;
      next_game: { title: string; at: string; joined: number; max: number } | null;
    }
  | {
      slug: "debtmanager";
      currency: string;
      debt_free_month: string | null;
      on_track: boolean;
      owed_cents: number;
      interest_cents: number;
      net_this_month_cents: number;
    }
  | {
      slug: "honeydoeh";
      currency: string;
      spend_mtd: number;
      spend_vs_last: number;
      open_todos: number;
      overdue_todos: number;
      top_creep: { name: string; change_pct: number } | null;
    };

function PulseBody({ p }: { p: Pulse }) {
  if (p.slug === "sportly") {
    const g = p.next_game;
    return (
      <>
        <Hero value={money(p.wallets_cents, "CAD")} label="in players' wallets" tone="accent" />
        <Stats
          items={[
            { label: "new players 7d", value: p.new_players_7d, tone: p.new_players_7d ? "ok" : undefined },
            { label: "comeback rate", value: pct(p.comeback_pct) },
          ]}
        />
        {g && (
          <Note>
            Next game: <strong>{g.title}</strong>, {g.joined}/{g.max} spots ·{" "}
            {new Date(g.at).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}
          </Note>
        )}
      </>
    );
  }
  if (p.slug === "debtmanager") {
    return (
      <>
        <Hero
          value={p.debt_free_month ? monthLabel(p.debt_free_month) : p.on_track ? "Debt-free" : "Not on track"}
          label={p.debt_free_month ? "debt-free" : undefined}
          tone={p.on_track ? "accent" : "bad"}
        />
        <Stats
          items={[
            { label: "owed", value: money(p.owed_cents, p.currency) },
            { label: "interest / mo", value: money(p.interest_cents, p.currency) },
            {
              label: `paid down ${new Date().toLocaleDateString("en-CA", { month: "short" })}`,
              value: money(p.net_this_month_cents, p.currency, { sign: true }),
              tone: p.net_this_month_cents >= 0 ? "ok" : "bad",
            },
          ]}
        />
      </>
    );
  }
  return (
    <>
      <Hero
        value={dollars(p.spend_mtd, p.currency)}
        label={
          <>
            spent this month ·{" "}
            <Pill tone={p.spend_vs_last > 0 ? "bad" : "ok"}>{dollars(p.spend_vs_last, p.currency, { sign: true })} vs last month</Pill>
          </>
        }
      />
      <Stats
        items={[
          { label: "open todos", value: p.open_todos },
          { label: "overdue", value: p.overdue_todos, tone: p.overdue_todos ? "bad" : "ok" },
        ]}
      />
      {p.top_creep && (
        <Note>
          Biggest price rise: <strong>{p.top_creep.name}</strong> +{p.top_creep.change_pct.toFixed(0)}%
        </Note>
      )}
    </>
  );
}

export function Pulse({ app, onRemove }: WidgetProps) {
  const { data: d, error, loading } = useInsight<Pulse>("pulse", { app });
  const label = useAppLabel();
  return (
    <InsightFrame title={label(app)} meta="pulse" loading={loading} error={error} onRemove={onRemove}>
      {d && (
        <div className="ins-stack">
          <PulseBody p={d} />
          <Link to={`/app/${app}`} className="ov-open">
            Open {label(app)} →
          </Link>
        </div>
      )}
    </InsightFrame>
  );
}

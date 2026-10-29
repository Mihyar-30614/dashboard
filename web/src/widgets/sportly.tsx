import {
  BarList,
  Empty,
  Hero,
  InsightFrame,
  Meter,
  Note,
  Pill,
  SeriesChart,
  Stats,
  dayLabel,
  money,
  pct,
  useInsight,
  type WidgetProps,
} from "./parts";

const APP = "sportly";
const C = "CAD";

type Wallet = {
  added_cents: number;
  added_count: number;
  withdrawn_cents: number;
  withdrawn_count: number;
  pending_withdrawal_cents: number;
  wallets_cents: number;
  wallets_funded: number;
  held_cents: number;
  owed_cents: number;
  difference_cents: number;
  series: { t: string; added_cents: number; withdrawn_cents: number }[];
};

export function SpWalletMoney({ onRemove }: WidgetProps) {
  const { data: d, error, loading } = useInsight<Wallet>("sp_wallet_money", { app: APP });
  const balanced = d && Math.abs(d.difference_cents) < 1;
  return (
    <InsightFrame title="Wallet money" meta="all time" loading={loading} error={error} onRemove={onRemove}>
      {d && (
        <div className="ins-stack ins-stack--fill">
          <Stats
            items={[
              { label: `added · ${d.added_count} e-Transfers`, value: money(d.added_cents, C), tone: "ok" },
              { label: `withdrawn · ${d.withdrawn_count} payouts`, value: money(d.withdrawn_cents, C) },
              { label: `in wallets · ${d.wallets_funded} players`, value: money(d.wallets_cents, C), tone: "accent" },
              ...(d.held_cents || d.pending_withdrawal_cents
                ? [
                    { label: "held for games", value: money(d.held_cents, C) },
                    { label: "payouts pending", value: money(d.pending_withdrawal_cents, C) },
                  ]
                : []),
            ]}
          />
          <Note tone={balanced ? "ok" : "warn"}>
            {balanced
              ? "Balanced: added − withdrawn equals what players still hold."
              : `Off by ${money(d.difference_cents, C, { sign: true })}: added − withdrawn ≠ wallets + held + pending.`}
          </Note>
          {d.series.length > 1 && (
            <SeriesChart
              data={d.series}
              xKey="t"
              xFormat={dayLabel}
              yFormat={(v) => money(v, C, { compact: true })}
              tipFormat={(v) => money(v, C)}
              series={[
                { key: "added_cents", label: "Added (cumulative)", color: "var(--ok)", kind: "area" },
                { key: "withdrawn_cents", label: "Withdrawn (cumulative)", color: "var(--chart-3)", kind: "area" },
              ]}
            />
          )}
        </div>
      )}
    </InsightFrame>
  );
}

type Flow = {
  weeks: { week: string; topups_cents: number; fees_cents: number; host_cents: number; withdrawn_cents: number }[];
};

export function SpMoneyFlow({ params = {}, onRemove }: WidgetProps) {
  const period = params.period || "12w";
  const { data: d, error, loading } = useInsight<Flow>("sp_money_flow", { app: APP, period });
  const sum = (k: keyof Flow["weeks"][number]) => d?.weeks.reduce((s, w) => s + (w[k] as number), 0) ?? 0;
  const thisWeek = d?.weeks.at(-1);
  return (
    <InsightFrame title="Money flow" meta={`weekly · ${period}`} loading={loading} error={error} onRemove={onRemove}>
      {d && (
        <div className="ins-stack ins-stack--fill">
          <Stats
            items={[
              { label: "topped up", value: money(sum("topups_cents"), C), tone: "ok" },
              { label: "game fees", value: money(sum("fees_cents"), C) },
              { label: "paid to hosts", value: money(sum("host_cents"), C) },
              { label: "this week in", value: money(thisWeek?.topups_cents, C) },
            ]}
          />
          <SeriesChart
            data={d.weeks}
            xKey="week"
            xFormat={dayLabel}
            yFormat={(v) => money(v, C, { compact: true })}
            tipFormat={(v) => money(v, C)}
            series={[
              { key: "topups_cents", label: "Top-ups", color: "var(--chart-2)", kind: "bar" },
              { key: "fees_cents", label: "Game fees", color: "var(--chart-1)", kind: "bar" },
              { key: "host_cents", label: "To hosts", color: "var(--chart-5)", kind: "bar" },
              { key: "withdrawn_cents", label: "Withdrawn", color: "var(--chart-3)", kind: "bar" },
            ]}
          />
        </div>
      )}
    </InsightFrame>
  );
}

type Funnel = { steps: { key: string; label: string; count: number }[] };

export function SpFunnel({ onRemove }: WidgetProps) {
  const { data: d, error, loading } = useInsight<Funnel>("sp_funnel", { app: APP });
  const top = d?.steps[0]?.count || 1;
  // Biggest drop between consecutive steps is where to look first.
  const leak =
    d?.steps.slice(1).reduce<{ from: string; to: string; lost: number } | null>((best, s, i) => {
      const lost = d.steps[i].count - s.count;
      return !best || lost > best.lost ? { from: d.steps[i].label, to: s.label, lost } : best;
    }, null) ?? null;
  return (
    <InsightFrame title="Activation funnel" meta="all players" loading={loading} error={error} onRemove={onRemove}>
      {d && (
        <div className="ins-stack">
          <ul className="ins-funnel">
            {d.steps.map((s, i) => {
              const prev = i ? d.steps[i - 1].count : s.count;
              return (
                <li key={s.key} className="ins-funnel__row">
                  <span className="ins-funnel__label">{s.label}</span>
                  <div className="ins-funnel__bar">
                    <span className="ins-funnel__fill" style={{ width: `${(s.count / top) * 100}%` }} />
                  </div>
                  <span className="metric ins-funnel__count">{s.count}</span>
                  <span className="ins-funnel__conv">{i ? pct((s.count / Math.max(prev, 1)) * 100) : ""}</span>
                </li>
              );
            })}
          </ul>
          {leak && leak.lost > 0 && (
            <Note tone="warn">
              Biggest drop: {leak.lost} players between “{leak.from}” and “{leak.to}”.
            </Note>
          )}
        </div>
      )}
    </InsightFrame>
  );
}

type Growth = { days: { t: string; signups: number; first_joins: number }[]; signups: number; first_joins: number };

export function SpGrowth({ params = {}, onRemove }: WidgetProps) {
  const range = params.range || "30d";
  const { data: d, error, loading } = useInsight<Growth>("sp_growth", { app: APP, range });
  return (
    <InsightFrame title="Launch curve" meta={`daily · ${range}`} loading={loading} error={error} onRemove={onRemove}>
      {d && (
        <div className="ins-stack ins-stack--fill">
          <Stats
            items={[
              { label: "new players", value: d.signups, tone: "accent" },
              { label: "first games joined", value: d.first_joins, tone: "ok" },
              {
                label: "signup → first game",
                value: d.signups ? pct((d.first_joins / d.signups) * 100) : "—",
              },
            ]}
          />
          <SeriesChart
            data={d.days}
            xKey="t"
            xFormat={dayLabel}
            yFormat={(v) => String(v)}
            series={[
              { key: "signups", label: "Signups", color: "var(--chart-1)", kind: "bar" },
              { key: "first_joins", label: "First game", color: "var(--chart-2)", kind: "bar" },
            ]}
          />
        </div>
      )}
    </InsightFrame>
  );
}

type Retention = {
  players: number;
  repeat_players: number;
  repeat_rate_pct: number | null;
  gone_quiet: number;
  booked: number;
  distribution: { games: number; players: number }[];
};

export function SpRetention({ onRemove }: WidgetProps) {
  const { data: d, error, loading } = useInsight<Retention>("sp_retention", { app: APP });
  return (
    <InsightFrame title="Comeback rate" meta="players who joined more than once" loading={loading} error={error} onRemove={onRemove}>
      {d &&
        (d.players ? (
          <div className="ins-stack">
            <Hero
              value={pct(d.repeat_rate_pct)}
              tone={(d.repeat_rate_pct ?? 0) >= 50 ? "ok" : "warn"}
              label={`${d.repeat_players} of ${d.players} players came back`}
            />
            <Stats
              items={[
                { label: "booked a game", value: d.booked, tone: "ok" },
                { label: "gone quiet 30d+", value: d.gone_quiet, tone: d.gone_quiet ? "warn" : undefined },
              ]}
            />
            <BarList
              rows={d.distribution.map((r) => ({
                key: String(r.games),
                label: r.games >= 5 ? "5+ games" : `${r.games} game${r.games > 1 ? "s" : ""}`,
                value: r.players,
                display: `${r.players} players`,
                tone: r.games >= 2 ? "ok" : "muted",
              }))}
            />
          </div>
        ) : (
          <Empty>No one has joined a game yet.</Empty>
        ))}
    </InsightFrame>
  );
}

type Invites = {
  sent: number;
  accepted: number;
  inviters: number;
  accept_rate_pct: number | null;
  top: { name: string; sent: number; accepted: number }[];
};

export function SpInvites({ onRemove }: WidgetProps) {
  const { data: d, error, loading } = useInsight<Invites>("sp_invites", { app: APP });
  return (
    <InsightFrame title="Invite loop" meta="game invitations" loading={loading} error={error} onRemove={onRemove}>
      {d &&
        (d.sent ? (
          <div className="ins-stack">
            <Hero value={pct(d.accept_rate_pct)} label={`of ${d.sent} invites turned into a player in the game`} />
            <Stats
              items={[
                { label: "invites sent", value: d.sent },
                { label: "accepted", value: d.accepted, tone: "ok" },
                { label: "people inviting", value: d.inviters, tone: d.inviters <= 1 ? "warn" : undefined },
              ]}
            />
            {d.inviters <= 1 && <Note tone="warn">Every invite comes from one person; players aren't inviting each other yet.</Note>}
            <BarList
              rows={d.top.map((t) => ({
                key: t.name,
                label: t.name,
                value: t.accepted,
                display: `${t.accepted} / ${t.sent}`,
                tone: "accent",
              }))}
            />
          </div>
        ) : (
          <Empty>No invitations sent yet.</Empty>
        ))}
    </InsightFrame>
  );
}

type Games = {
  games: {
    id: number;
    title: string;
    sport_type: string;
    date_time: string;
    max_participants: number;
    fee_cents: number;
    cancelled: boolean;
    joined: number;
    waitlist: number;
    collected_cents: number;
    host_cents: number;
  }[];
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function SpGames({ onRemove }: WidgetProps) {
  const { data: d, error, loading } = useInsight<Games>("sp_games", { app: APP });
  const now = Date.now();
  return (
    <InsightFrame title="Game economics" meta="last 30 days and upcoming" loading={loading} error={error} onRemove={onRemove}>
      {d &&
        (d.games.length ? (
          <div className="ins-table-wrap">
            <table className="data-table ins-table">
              <thead>
                <tr>
                  <th>Game</th>
                  <th>When</th>
                  <th>Spots</th>
                  <th className="num">Fee</th>
                  <th className="num">Collected</th>
                  <th className="num">To host</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {d.games.map((g) => {
                  const past = new Date(g.date_time).getTime() < now;
                  const full = g.joined >= g.max_participants;
                  return (
                    <tr key={g.id} className={g.cancelled ? "ins-table__row--muted" : undefined}>
                      <td>
                        <div className="ins-list__title">{g.title}</div>
                        <div className="ins-list__sub">{g.sport_type}</div>
                      </td>
                      <td className="ins-nowrap">{when(g.date_time)}</td>
                      <td className="ins-spots">
                        <span className="metric">
                          {g.joined}/{g.max_participants}
                        </span>
                        <Meter value={g.joined} max={g.max_participants} tone={full ? "ok" : "accent"} />
                      </td>
                      <td className="num metric">{money(g.fee_cents, C)}</td>
                      <td className="num metric">{money(g.collected_cents, C)}</td>
                      <td className="num metric">{money(g.host_cents, C)}</td>
                      <td>
                        {g.cancelled ? (
                          <Pill tone="bad">cancelled</Pill>
                        ) : full ? (
                          <Pill tone="ok">{g.waitlist ? `full · ${g.waitlist} waiting` : "full"}</Pill>
                        ) : past ? (
                          <Pill>played</Pill>
                        ) : (
                          <Pill tone="accent">upcoming</Pill>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No games in the last 30 days or coming up.</Empty>
        ))}
    </InsightFrame>
  );
}

type Todos = { total: number; items: { key: string; label: string; count: number; amount_cents?: number }[] };

export function SpAdminTodos({ onRemove }: WidgetProps) {
  const { data: d, error, loading } = useInsight<Todos>("sp_admin_todos", { app: APP });
  const open = d?.items.filter((i) => i.count > 0) ?? [];
  return (
    <InsightFrame title="Admin to-dos" meta="sportly" loading={loading} error={error} onRemove={onRemove}>
      {d &&
        (d.total === 0 ? (
          <Hero value="All clear" tone="ok" label="nothing waiting on you" />
        ) : (
          <ul className="ins-list">
            {open.map((i) => (
              <li key={i.key} className="ins-list__row">
                <div className="ins-list__title">{i.label}</div>
                <div className="ins-list__end">
                  {i.amount_cents ? <span className="ins-list__sub">{money(i.amount_cents, C)}</span> : null}
                  <Pill tone="warn">{i.count}</Pill>
                </div>
              </li>
            ))}
          </ul>
        ))}
    </InsightFrame>
  );
}

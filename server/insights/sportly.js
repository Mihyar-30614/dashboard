// Sportly money: players top up their wallet by Interac e-Transfer, joining a
// paid game holds or debits the fee, the host is settled into their own
// wallet, and withdrawals are paid out by an admin.

export async function walletMoney(pool) {
  const [{ rows: [t] }, { rows: series }] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT COALESCE(SUM(amount_cents), 0) FROM incoming_bank_transfers WHERE purpose = 'credit')::float8 AS added_cents,
         (SELECT COUNT(*) FROM incoming_bank_transfers WHERE purpose = 'credit')::int AS added_count,
         (SELECT COALESCE(SUM(amount_cents), 0) FROM wallet_withdrawals WHERE status = 'paid' AND returned_at IS NULL)::float8 AS withdrawn_cents,
         (SELECT COUNT(*) FROM wallet_withdrawals WHERE status = 'paid' AND returned_at IS NULL)::int AS withdrawn_count,
         (SELECT COALESCE(SUM(amount_cents), 0) FROM wallet_withdrawals WHERE status = 'pending')::float8 AS pending_withdrawal_cents,
         (SELECT COALESCE(SUM(balance_cents), 0) FROM wallets)::float8 AS wallets_cents,
         (SELECT COUNT(*) FROM wallets WHERE balance_cents > 0)::int AS wallets_funded,
         (SELECT COALESCE(SUM(amount_cents), 0) FROM wallet_holds WHERE status = 'held')::float8 AS held_cents`,
    ),
    pool.query(
      `WITH ev AS (
         SELECT recorded_at::date AS d, amount_cents AS added, 0 AS withdrawn
           FROM incoming_bank_transfers WHERE purpose = 'credit'
         UNION ALL
         SELECT resolved_at::date, 0, amount_cents
           FROM wallet_withdrawals WHERE status = 'paid' AND returned_at IS NULL AND resolved_at IS NOT NULL
       ), daily AS (
         SELECT d, SUM(added) AS added, SUM(withdrawn) AS withdrawn FROM ev GROUP BY d
       )
       SELECT to_char(d, 'YYYY-MM-DD') AS t,
              (SUM(added) OVER (ORDER BY d))::float8 AS added_cents,
              (SUM(withdrawn) OVER (ORDER BY d))::float8 AS withdrawn_cents
         FROM daily ORDER BY d`,
    ),
  ]);
  // Pending withdrawals are already debited from the wallet, so they sit on
  // the "still owed" side alongside balances and holds.
  const owed = t.wallets_cents + t.held_cents + t.pending_withdrawal_cents;
  return {
    ...t,
    owed_cents: owed,
    difference_cents: t.added_cents - t.withdrawn_cents - owed,
    series,
  };
}

export async function moneyFlow(pool, _appCfg, params) {
  const weeks = { "8w": 8, "12w": 12, "26w": 26 }[params.period] || 12;
  const { rows } = await pool.query(
    `WITH weeks AS (
       SELECT generate_series(
                date_trunc('week', NOW()) - ($1::int - 1) * INTERVAL '1 week',
                date_trunc('week', NOW()), INTERVAL '1 week') AS w
     )
     SELECT to_char(w, 'YYYY-MM-DD') AS week,
            COALESCE(SUM(t.amount_cents) FILTER (WHERE t.kind = 'admin_credit'), 0)::float8 AS topups_cents,
            COALESCE(-SUM(t.amount_cents) FILTER (WHERE t.kind IN ('join_paid', 'join_hold')), 0)::float8 AS fees_cents,
            COALESCE(SUM(t.amount_cents) FILTER (WHERE t.kind = 'host_settle'), 0)::float8 AS host_cents,
            COALESCE(-SUM(t.amount_cents) FILTER (WHERE t.kind = 'withdraw_request'), 0)::float8 AS withdrawn_cents
       FROM weeks
       LEFT JOIN wallet_transactions t
         ON t.created_at >= w AND t.created_at < w + INTERVAL '1 week'
      GROUP BY w ORDER BY w`,
    [weeks],
  );
  return { weeks: rows };
}

const LIVE_USER = `anonymized_at IS NULL`;

export async function funnel(pool) {
  const { rows: [r] } = await pool.query(
    `WITH u AS (SELECT id, email_verified FROM users WHERE ${LIVE_USER}),
          games AS (SELECT user_id, COUNT(*) AS n FROM event_participants GROUP BY user_id),
          payers AS (SELECT DISTINCT user_id FROM wallet_transactions WHERE kind IN ('join_paid', 'join_hold'))
     SELECT COUNT(*)::int AS signed_up,
            COUNT(*) FILTER (WHERE u.email_verified)::int AS verified,
            COUNT(g.user_id)::int AS joined,
            COUNT(p.user_id)::int AS paid,
            COUNT(*) FILTER (WHERE g.n >= 2)::int AS repeat
       FROM u
       LEFT JOIN games g ON g.user_id = u.id
       LEFT JOIN payers p ON p.user_id = u.id`,
  );
  return {
    steps: [
      { key: "signed_up", label: "Signed up", count: r.signed_up },
      { key: "verified", label: "Verified email", count: r.verified },
      { key: "joined", label: "Joined a game", count: r.joined },
      { key: "paid", label: "Paid for a game", count: r.paid },
      { key: "repeat", label: "Joined 2+ games", count: r.repeat },
    ],
  };
}

export async function growth(pool, _appCfg, params) {
  const days = { "7d": 7, "30d": 30, "90d": 90 }[params.range] || 30;
  const { rows } = await pool.query(
    `WITH days AS (
       SELECT generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, INTERVAL '1 day')::date AS d
     ), first_game AS (
       SELECT user_id, MIN(created_at)::date AS d FROM event_participants GROUP BY user_id
     )
     SELECT to_char(days.d, 'YYYY-MM-DD') AS t,
            (SELECT COUNT(*) FROM users u WHERE u.created_at::date = days.d)::int AS signups,
            (SELECT COUNT(*) FROM first_game f WHERE f.d = days.d)::int AS first_joins
       FROM days ORDER BY days.d`,
    [days],
  );
  const total = (k) => rows.reduce((s, r) => s + r[k], 0);
  return { days: rows, signups: total("signups"), first_joins: total("first_joins") };
}

export async function retention(pool) {
  const [{ rows: dist }, { rows: [q] }] = await Promise.all([
    pool.query(
      `SELECT LEAST(n, 5)::int AS games, COUNT(*)::int AS players
         FROM (SELECT ep.user_id, COUNT(*) AS n
                 FROM event_participants ep JOIN events e ON e.id = ep.event_id
                WHERE e.cancelled_at IS NULL GROUP BY ep.user_id) x
        GROUP BY 1 ORDER BY 1`,
    ),
    // Gone quiet: played in the past, nothing in the last 30 days, nothing booked.
    pool.query(
      `WITH pg AS (
         SELECT ep.user_id, MAX(e.date_time) AS last_game,
                BOOL_OR(e.date_time > NOW()) AS has_upcoming
           FROM event_participants ep JOIN events e ON e.id = ep.event_id
          WHERE e.cancelled_at IS NULL GROUP BY ep.user_id
       )
       SELECT COUNT(*) FILTER (WHERE NOT has_upcoming AND last_game < NOW() - INTERVAL '30 days')::int AS gone_quiet,
              COUNT(*) FILTER (WHERE has_upcoming)::int AS booked
         FROM pg`,
    ),
  ]);
  const players = dist.reduce((s, r) => s + r.players, 0);
  const repeat = dist.filter((r) => r.games >= 2).reduce((s, r) => s + r.players, 0);
  return {
    players,
    repeat_players: repeat,
    repeat_rate_pct: players ? (repeat / players) * 100 : null,
    gone_quiet: q.gone_quiet,
    booked: q.booked,
    distribution: dist,
  };
}

export async function invites(pool) {
  const [{ rows: [t] }, { rows: top }] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS sent,
              COUNT(ep.user_id)::int AS accepted,
              COUNT(DISTINCT i.invited_by)::int AS inviters
         FROM event_invitations i
         LEFT JOIN event_participants ep ON ep.event_id = i.event_id AND ep.user_id = i.user_id`,
    ),
    pool.query(
      `SELECT COALESCE(u.name, 'Unknown') AS name,
              COUNT(*)::int AS sent, COUNT(ep.user_id)::int AS accepted
         FROM event_invitations i
         JOIN users u ON u.id = i.invited_by
         LEFT JOIN event_participants ep ON ep.event_id = i.event_id AND ep.user_id = i.user_id
        GROUP BY u.id, u.name ORDER BY accepted DESC, sent DESC LIMIT 5`,
    ),
  ]);
  return {
    ...t,
    accept_rate_pct: t.sent ? (t.accepted / t.sent) * 100 : null,
    top,
  };
}

export async function games(pool) {
  const { rows } = await pool.query(
    `SELECT e.id, e.title, e.sport_type, e.date_time, e.max_participants,
            e.ticket_fee::float8 * 100 AS fee_cents,
            e.cancelled_at IS NOT NULL AS cancelled,
            (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id)::int AS joined,
            (SELECT COUNT(*) FROM event_waitlist w WHERE w.event_id = e.id)::int AS waitlist,
            (SELECT COALESCE(-SUM(amount_cents), 0) FROM wallet_transactions t
              WHERE t.event_id = e.id AND t.kind IN ('join_paid', 'join_hold'))::float8 AS collected_cents,
            (SELECT COALESCE(SUM(amount_cents), 0) FROM wallet_transactions t
              WHERE t.event_id = e.id AND t.kind = 'host_settle')::float8 AS host_cents
       FROM events e
      WHERE e.date_time > NOW() - INTERVAL '30 days'
      ORDER BY e.date_time`,
  );
  return { games: rows };
}

export async function adminTodos(pool) {
  const { rows: [r] } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM wallet_withdrawals WHERE status = 'pending')::int AS withdrawals,
       (SELECT COALESCE(SUM(amount_cents), 0) FROM wallet_withdrawals WHERE status = 'pending')::float8 AS withdrawals_cents,
       (SELECT COUNT(*) FROM wallet_refund_requests WHERE status = 'pending')::int AS refunds,
       (SELECT COUNT(*) FROM payment_support_cases WHERE status = 'open')::int AS support_cases,
       (SELECT COUNT(*) FROM interac_notices WHERE status = 'review')::int AS etransfers,
       (SELECT COUNT(*) FROM host_payout_recoveries WHERE status = 'due')::int AS recoveries,
       (SELECT COUNT(*) FROM feedback WHERE status = 'new')::int AS feedback`,
  );
  const items = [
    { key: "withdrawals", label: "Withdrawals to pay", count: r.withdrawals, amount_cents: r.withdrawals_cents },
    { key: "etransfers", label: "e-Transfers to match", count: r.etransfers },
    { key: "refunds", label: "Refund requests", count: r.refunds },
    { key: "support_cases", label: "Payment support cases", count: r.support_cases },
    { key: "recoveries", label: "Host payouts to recover", count: r.recoveries },
    { key: "feedback", label: "Unread feedback", count: r.feedback },
  ];
  return { total: items.reduce((s, i) => s + i.count, 0), items };
}

export async function jobs(pool) {
  const { rows: [r] } = await pool.query(
    `SELECT (SELECT COUNT(*) FROM interac_notices WHERE status = 'review')::int AS review,
            (SELECT MAX(received_at) FROM interac_notices) AS last_at`,
  );
  return { label: "e-Transfers to match", value: r.review, last_at: r.last_at, attention: r.review };
}

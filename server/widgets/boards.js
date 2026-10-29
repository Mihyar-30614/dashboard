// Default board per screen. Each row is laid out left to right on the
// 12-column grid; the narrow-viewport layouts are derived from these.
const w = (kind, app, width, height, params = {}) => ({ kind, app, w: width, h: height, params });

function place(rows, prefix) {
  const out = [];
  let y = 0;
  for (const row of rows) {
    let x = 0;
    let tallest = 0;
    for (const cell of row) {
      // A cell may be a column of widgets stacked in the same x span.
      const stack = Array.isArray(cell) ? cell : [cell];
      let cy = y;
      for (const item of stack) {
        out.push({ id: `${prefix}${out.length + 1}`, ...item, x, y: cy });
        cy += item.h;
      }
      x += stack[0].w;
      tallest = Math.max(tallest, cy - y);
    }
    y += tallest;
  }
  return out;
}

export function defaultBoard(screen, slugs) {
  if (screen === "overview") {
    return place(
      [
        slugs.map((s) => w("app_status", s, 4, 3)),
        slugs.map((s) => w("uptime", s, 4, 2, { range: "7d" })),
        [w("sp_admin_todos", "sportly", 4, 4)],
      ],
      "o",
    );
  }
  if (screen === "sportly") {
    return place(
      [
        [w("app_status", screen, 8, 2), w("traffic", screen, 4, 2)],
        [w("sp_wallet_money", screen, 6, 5), w("sp_money_flow", screen, 6, 5, { period: "12w" })],
        [w("sp_funnel", screen, 4, 5), w("sp_retention", screen, 4, 5), w("sp_invites", screen, 4, 5)],
        [w("sp_growth", screen, 8, 4, { range: "30d" }), w("sp_admin_todos", screen, 4, 4)],
        [w("sp_games", screen, 12, 5)],
        [w("uptime", screen, 12, 2, { range: "7d" })],
      ],
      "s",
    );
  }
  if (screen === "debtmanager") {
    return place(
      [
        [w("dm_payoff", screen, 5, 5), w("dm_balance_trend", screen, 7, 5, { period: "1y" })],
        [w("dm_interest", screen, 4, 5), w("dm_utilization", screen, 4, 5), w("dm_bills_due", screen, 4, 5, { days: "14" })],
        [w("dm_paid_vs_charged", screen, 6, 5, { period: "12m" }), w("dm_cashflow", screen, 6, 5, { period: "12m" })],
        [w("dm_category_movers", screen, 6, 5), [w("app_status", screen, 6, 2), w("uptime", screen, 6, 2, { range: "7d" })]],
      ],
      "d",
    );
  }
  if (screen === "honeydoeh") {
    return place(
      [
        [w("hd_spend", screen, 4, 6), w("hd_price_creep", screen, 4, 6), w("hd_todo_flow", screen, 4, 6)],
        [w("app_status", screen, 8, 2), w("uptime", screen, 4, 2, { range: "7d" })],
      ],
      "h",
    );
  }
  return place([[w("app_status", screen, 8, 2), w("uptime", screen, 4, 2, { range: "7d" })]], "a");
}

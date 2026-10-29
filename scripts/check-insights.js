// Runs every built-in metric kind against the live app databases and prints
// a one-line summary each, so query changes can be checked against real data.
//   node --env-file=.env scripts/check-insights.js [kind-prefix]
import { loadApps } from "../server/config.js";
import { getAppPool } from "../server/appPools.js";
import { WIDGETS } from "../server/widgets/registry.js";
import * as dm from "../server/insights/debtmanager.js";
import * as sp from "../server/insights/sportly.js";
import * as hd from "../server/insights/honeydoeh.js";

const RUN = {
  dm_payoff: dm.payoff, dm_interest: dm.interest, dm_paid_vs_charged: dm.paidVsCharged,
  dm_balance_trend: dm.balanceTrend, dm_utilization: dm.utilization, dm_cashflow: dm.cashflow,
  dm_category_movers: dm.categoryMovers, dm_bills_due: dm.billsDue,
  sp_wallet_money: sp.walletMoney, sp_money_flow: sp.moneyFlow, sp_funnel: sp.funnel,
  sp_growth: sp.growth, sp_retention: sp.retention, sp_invites: sp.invites,
  sp_games: sp.games, sp_admin_todos: sp.adminTodos,
  hd_spend: hd.spend, hd_price_creep: hd.priceCreep, hd_todo_flow: hd.todoFlow,
};

const apps = loadApps();
const prefix = process.argv[2] || "";
let failed = 0;
for (const w of WIDGETS) {
  if (!RUN[w.kind] || !w.kind.startsWith(prefix)) continue;
  for (const slug of w.apps || []) {
    const params = Object.fromEntries((w.paramsSchema || []).filter((p) => p.default).map((p) => [p.name, p.default]));
    try {
      const out = await RUN[w.kind](getAppPool(slug), apps[slug], params);
      console.log(`ok   ${w.kind.padEnd(20)} ${JSON.stringify(out).slice(0, 600)}`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${w.kind.padEnd(20)} ${e.message}`);
    }
  }
}
for (const slug of Object.keys(apps)) await getAppPool(slug).end();
process.exit(failed ? 1 : 0);

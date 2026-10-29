import type { FC } from "react";
import widgetsMeta from "@config/widgets.json";
import type { ParamField } from "../grid/paramsEditing";
import { AppStatus, HealthCard, Pm2Card, TrafficCard, UptimeStrip } from "./metrics";
import {
  DmBalanceTrend,
  DmBillsDue,
  DmCashflow,
  DmCategoryMovers,
  DmInterest,
  DmPaidVsCharged,
  DmPayoff,
  DmUtilization,
} from "./debt";
import {
  SpAdminTodos,
  SpFunnel,
  SpGames,
  SpGrowth,
  SpInvites,
  SpMoneyFlow,
  SpRetention,
  SpWalletMoney,
} from "./sportly";
import { HdPriceCreep, HdSpend, HdTodoFlow } from "./honeydoeh";
import SqlWidget from "./sql";

type WidgetMeta = (typeof widgetsMeta)[number];

export type WidgetDef = {
  label: string;
  description: string;
  defaultSize: { w: number; h: number };
  scope: "app" | "overview" | "both";
  /** Only offered on these apps' boards (and pinned to them on overview). */
  apps?: string[];
  paramsSchema: ParamField[];
  Component: FC<any>;
};

const COMPONENTS: Record<string, FC<any>> = {
  app_status: AppStatus,
  health: HealthCard,
  pm2: Pm2Card,
  uptime: UptimeStrip,
  traffic: TrafficCard,
  dm_payoff: DmPayoff,
  dm_interest: DmInterest,
  dm_paid_vs_charged: DmPaidVsCharged,
  dm_balance_trend: DmBalanceTrend,
  dm_utilization: DmUtilization,
  dm_cashflow: DmCashflow,
  dm_category_movers: DmCategoryMovers,
  dm_bills_due: DmBillsDue,
  sp_wallet_money: SpWalletMoney,
  sp_money_flow: SpMoneyFlow,
  sp_funnel: SpFunnel,
  sp_growth: SpGrowth,
  sp_retention: SpRetention,
  sp_invites: SpInvites,
  sp_games: SpGames,
  sp_admin_todos: SpAdminTodos,
  hd_spend: HdSpend,
  hd_price_creep: HdPriceCreep,
  hd_todo_flow: HdTodoFlow,
  sql: SqlWidget,
};

export const WIDGETS: Record<string, WidgetDef> = Object.fromEntries(
  (widgetsMeta as WidgetMeta[]).map((w) => [
    w.kind,
    {
      label: w.label,
      description: w.description,
      defaultSize: w.defaultSize,
      scope: w.scope as WidgetDef["scope"],
      apps: "apps" in w ? (w.apps as string[]) : undefined,
      paramsSchema: (w.paramsSchema ?? []) as ParamField[],
      Component: COMPONENTS[w.kind],
    },
  ]),
);

import type { FC } from "react";
import widgetsMeta from "@config/widgets.json";
import type { ParamField } from "../grid/paramsEditing";
import {
  KpiCard,
  KpiDelta,
  KpiMultiStat,
  KpiSparkline,
  KpiTarget,
} from "./kpis";
import {
  ActiveTimeseries,
  KpiTimeseries,
  SignupsTimeseries,
} from "./charts";
import {
  DauCard,
  HealthCard,
  HttpErrors,
  HttpLatency,
  HttpRate,
  Pm2Card,
  UptimeStrip,
  UsersTotal,
} from "./metrics";
import SqlWidget from "./sql";

type WidgetMeta = (typeof widgetsMeta)[number];

export type WidgetDef = {
  label: string;
  description: string;
  defaultSize: { w: number; h: number };
  scope: "app" | "overview" | "both";
  paramsSchema: ParamField[];
  Component: FC<any>;
};

const COMPONENTS: Record<string, FC<any>> = {
  users_total: UsersTotal,
  dau: DauCard,
  health: HealthCard,
  signups_timeseries: SignupsTimeseries,
  active_timeseries: ActiveTimeseries,
  pm2: Pm2Card,
  http_rate: HttpRate,
  http_errors: HttpErrors,
  http_latency: HttpLatency,
  kpi: KpiCard,
  kpi_timeseries: KpiTimeseries,
  kpi_sparkline: KpiSparkline,
  kpi_delta: KpiDelta,
  kpi_target: KpiTarget,
  kpi_multistat: KpiMultiStat,
  uptime: UptimeStrip,
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
      paramsSchema: (w.paramsSchema ?? []) as ParamField[],
      Component: COMPONENTS[w.kind],
    },
  ]),
);

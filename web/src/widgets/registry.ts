import type { FC } from "react";
import widgetsMeta from "@config/widgets.json";
import type { ParamField } from "../grid/paramsEditing";
import SqlWidget from "./SqlWidget";
import UsersTotal from "./UsersTotal";
import DauCard from "./DauCard";
import HealthCard from "./HealthCard";
import SignupsTimeseries from "./SignupsTimeseries";
import ActiveTimeseries from "./ActiveTimeseries";
import Pm2Card from "./Pm2Card";
import HttpRate from "./HttpRate";
import HttpErrors from "./HttpErrors";
import HttpLatency from "./HttpLatency";
import KpiCard from "./KpiCard";
import KpiTimeseries from "./KpiTimeseries";
import KpiSparkline from "./KpiSparkline";
import KpiDelta from "./KpiDelta";
import KpiTarget from "./KpiTarget";
import KpiMultiStat from "./KpiMultiStat";

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

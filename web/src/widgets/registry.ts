import type { FC } from "react";
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

export type WidgetDef = {
  label: string;
  description: string;
  defaultSize: { w: number; h: number };
  scope: "app" | "overview" | "both";
  Component: FC<any>;
};

export const WIDGETS: Record<string, WidgetDef> = {
  users_total: {
    label: "Users (total)",
    description: "Lifetime registered user count for the selected app.",
    defaultSize: { w: 2, h: 2 },
    scope: "app" as const,
    Component: UsersTotal,
  },
  dau: {
    label: "DAU",
    description: "Daily active users — distinct users seen in the last 24h.",
    defaultSize: { w: 2, h: 2 },
    scope: "app" as const,
    Component: DauCard,
  },
  health: {
    label: "Health",
    description: "Up/down status and response latency from the health probe.",
    defaultSize: { w: 2, h: 2 },
    scope: "both" as const,
    Component: HealthCard,
  },
  signups_timeseries: {
    label: "Signups over time",
    description: "Daily new account creations plotted over the selected range.",
    defaultSize: { w: 6, h: 4 },
    scope: "app" as const,
    Component: SignupsTimeseries,
  },
  active_timeseries: {
    label: "DAU over time",
    description: "Daily active users trended across the selected range.",
    defaultSize: { w: 6, h: 4 },
    scope: "app" as const,
    Component: ActiveTimeseries,
  },
  pm2: {
    label: "PM2 status",
    description: "Process state, CPU, and memory reported by PM2.",
    defaultSize: { w: 3, h: 2 },
    scope: "both" as const,
    Component: Pm2Card,
  },
  http_rate: {
    label: "Requests",
    description: "HTTP request throughput — requests per minute.",
    defaultSize: { w: 3, h: 2 },
    scope: "app" as const,
    Component: HttpRate,
  },
  http_errors: {
    label: "HTTP errors",
    description: "Rate of 4xx and 5xx responses over the last window.",
    defaultSize: { w: 3, h: 2 },
    scope: "app" as const,
    Component: HttpErrors,
  },
  http_latency: {
    label: "p95 latency",
    description: "95th-percentile response time across recent requests.",
    defaultSize: { w: 3, h: 2 },
    scope: "app" as const,
    Component: HttpLatency,
  },
  kpi: {
    label: "KPI value",
    description: "Single configured KPI displayed as a large numeric readout.",
    defaultSize: { w: 3, h: 2 },
    scope: "app" as const,
    Component: KpiCard,
  },
  kpi_timeseries: {
    label: "KPI over time",
    description: "Configured KPI trended as a line chart over time.",
    defaultSize: { w: 6, h: 4 },
    scope: "app" as const,
    Component: KpiTimeseries,
  },
  kpi_sparkline: {
    label: "KPI · sparkline",
    description: "Compact KPI value with inline sparkline showing recent trend.",
    defaultSize: { w: 3, h: 2 },
    scope: "app" as const,
    Component: KpiSparkline,
  },
  kpi_delta: {
    label: "KPI · delta vs prior",
    description: "Current KPI value plus change vs the prior period.",
    defaultSize: { w: 3, h: 2 },
    scope: "app" as const,
    Component: KpiDelta,
  },
  kpi_target: {
    label: "KPI · target",
    description: "KPI value with progress bar toward a configured target.",
    defaultSize: { w: 3, h: 2 },
    scope: "app" as const,
    Component: KpiTarget,
  },
  kpi_multistat: {
    label: "KPI · multi-stat",
    description: "Side-by-side readout of several KPIs in one card.",
    defaultSize: { w: 6, h: 2 },
    scope: "app" as const,
    Component: KpiMultiStat,
  },
} as const;

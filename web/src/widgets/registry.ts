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

export type WidgetDef = {
  label: string;
  defaultSize: { w: number; h: number };
  scope: "app" | "overview" | "both";
  Component: FC<any>;
};

export const WIDGETS: Record<string, WidgetDef> = {
  users_total: {
    label: "Users (total)",
    defaultSize: { w: 2, h: 2 },
    scope: "app" as const,
    Component: UsersTotal,
  },
  dau: {
    label: "DAU",
    defaultSize: { w: 2, h: 2 },
    scope: "app" as const,
    Component: DauCard,
  },
  health: {
    label: "Health",
    defaultSize: { w: 2, h: 2 },
    scope: "both" as const,
    Component: HealthCard,
  },
  signups_timeseries: {
    label: "Signups over time",
    defaultSize: { w: 6, h: 4 },
    scope: "app" as const,
    Component: SignupsTimeseries,
  },
  active_timeseries: {
    label: "DAU over time",
    defaultSize: { w: 6, h: 4 },
    scope: "app" as const,
    Component: ActiveTimeseries,
  },
  pm2: {
    label: "PM2 status",
    defaultSize: { w: 3, h: 2 },
    scope: "both" as const,
    Component: Pm2Card,
  },
  http_rate: {
    label: "Requests",
    defaultSize: { w: 3, h: 2 },
    scope: "app" as const,
    Component: HttpRate,
  },
  http_errors: {
    label: "HTTP errors",
    defaultSize: { w: 3, h: 2 },
    scope: "app" as const,
    Component: HttpErrors,
  },
  http_latency: {
    label: "p95 latency",
    defaultSize: { w: 3, h: 2 },
    scope: "app" as const,
    Component: HttpLatency,
  },
  kpi: {
    label: "KPI value",
    defaultSize: { w: 3, h: 2 },
    scope: "app" as const,
    Component: KpiCard,
  },
  kpi_timeseries: {
    label: "KPI over time",
    defaultSize: { w: 6, h: 4 },
    scope: "app" as const,
    Component: KpiTimeseries,
  },
} as const;

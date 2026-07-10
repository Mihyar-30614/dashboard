import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import WidgetFrame from "../grid/WidgetFrame";
import Skeleton from "../grid/Skeleton";
import { useApps, useMetric } from "../api/hooks";

export type TimeseriesPoint = { t: string; value: number };

type WidgetProps = {
  app: string;
  params?: any;
  onRemove?: () => void;
};

export function Timeseries({
  data,
  color,
  chartType = "line",
}: {
  data: TimeseriesPoint[];
  color: string;
  chartType?: "line" | "bar" | "area";
}) {
  const common = (
    <>
      <CartesianGrid stroke="var(--grid-line)" />
      <XAxis dataKey="t" tick={{ fontSize: 10 }} />
      <YAxis tick={{ fontSize: 10 }} />
      <Tooltip />
    </>
  );
  if (chartType === "bar") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          {common}
          <Bar dataKey="value" fill={color} />
        </BarChart>
      </ResponsiveContainer>
    );
  }
  if (chartType === "area") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          {common}
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.18}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        {common}
        <Line type="monotone" dataKey="value" stroke={color} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function MetricTimeseries({
  app,
  params = {},
  onRemove,
  metric,
  title,
  color,
  extraParams,
}: WidgetProps & {
  metric: string;
  title: string;
  color: string;
  extraParams?: Record<string, unknown>;
}) {
  const q = useMetric(metric, {
    app,
    range: params.range || "30d",
    ...extraParams,
  });
  const data = ((q.data as any)?.data as TimeseriesPoint[]) || [];

  return (
    <WidgetFrame
      title={title}
      onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      {q.isLoading && data.length === 0 ? (
        <Skeleton variant="chart" />
      ) : (
        <Timeseries
          data={data}
          color={color}
          chartType={params.chart_type || "line"}
        />
      )}
    </WidgetFrame>
  );
}

export function SignupsTimeseries(props: WidgetProps) {
  return (
    <MetricTimeseries
      {...props}
      metric="signups_timeseries"
      title="Signups"
      color="var(--chart-1)"
      extraParams={{ bucket: "day" }}
    />
  );
}

export function ActiveTimeseries(props: WidgetProps) {
  return (
    <MetricTimeseries
      {...props}
      metric="active_timeseries"
      title="Active users"
      color="var(--chart-2)"
    />
  );
}

function useKpiLabel(app: string, key?: string) {
  const apps = useApps();
  if (!key) return key ?? "";
  const catalog = (
    apps.data as { slug: string; kpis?: { key: string; label?: string }[] }[] | undefined
  )?.find((a) => a.slug === app)?.kpis;
  return catalog?.find((k) => k.key === key)?.label || key;
}

export function KpiTimeseries({ app, params = {}, onRemove }: WidgetProps) {
  const q = useMetric("kpi_timeseries", {
    app,
    key: params.key,
    range: params.range || "30d",
  });
  const label = useKpiLabel(app, params.key);
  const data = ((q.data as any)?.data as TimeseriesPoint[]) || [];

  return (
    <WidgetFrame
      title={label}
      titleVariant="label"
      meta={app}
      onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      {q.isLoading && data.length === 0 ? (
        <Skeleton variant="chart" />
      ) : (
        <Timeseries
          data={data}
          color="var(--accent)"
          chartType={params.chart_type || "line"}
        />
      )}
    </WidgetFrame>
  );
}

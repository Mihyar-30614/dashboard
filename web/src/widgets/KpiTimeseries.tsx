import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import WidgetFrame from "../grid/WidgetFrame";
import { useMetric } from "../api/hooks";

export default function KpiTimeseries({
  app,
  params = {},

  onRemove,
}: {
  app: string;
  params?: any;

  onRemove?: () => void;
}) {
  const q = useMetric("kpi_timeseries", {
    app,
    key: params.key,
    range: params.range || "30d",
  });
  const data = ((q.data as any)?.data as { t: string; value: number }[]) || [];
  return (
    <WidgetFrame
      title={`KPI: ${params.key || ""}`}

      onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="var(--grid-line)" />
          <XAxis dataKey="t" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--chart-5)"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </WidgetFrame>
  );
}

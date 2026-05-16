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

export default function ActiveTimeseries({
  app,
  params = {},
  editing,
  onRemove,
}: {
  app: string;
  params?: any;
  editing: boolean;
  onRemove?: () => void;
}) {
  const q = useMetric("active_timeseries", {
    app,
    range: params.range || "30d",
  });
  const data = ((q.data as any)?.data as { t: string; value: number }[]) || [];
  return (
    <WidgetFrame
      title="Active users"
      editing={editing}
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
            stroke="var(--chart-2)"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </WidgetFrame>
  );
}

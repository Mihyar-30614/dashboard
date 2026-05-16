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

export default function SignupsTimeseries({
  app,
  params = {},

  onRemove,
}: {
  app: string;
  params?: any;

  onRemove?: () => void;
}) {
  const q = useMetric("signups_timeseries", {
    app,
    range: params.range || "30d",
    bucket: "day",
  });
  const data = ((q.data as any)?.data as { t: string; value: number }[]) || [];
  return (
    <WidgetFrame
      title="Signups"

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
            stroke="var(--chart-1)"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </WidgetFrame>
  );
}

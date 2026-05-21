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

export type TimeseriesPoint = { t: string; value: number };

export default function Timeseries({
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

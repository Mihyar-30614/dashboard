import WidgetFrame from "../grid/WidgetFrame";
import { useMetric } from "../api/hooks";
import Timeseries, { type TimeseriesPoint } from "./Timeseries";
import Skeleton from "../grid/Skeleton";

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
  const data = ((q.data as any)?.data as TimeseriesPoint[]) || [];
  return (
    <WidgetFrame
      title="Signups"
      onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      {q.isLoading && data.length === 0 ? (
        <Skeleton variant="chart" />
      ) : (
        <Timeseries
          data={data}
          color="var(--chart-1)"
          chartType={params.chart_type || "line"}
        />
      )}
    </WidgetFrame>
  );
}

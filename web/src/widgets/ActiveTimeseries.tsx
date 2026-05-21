import WidgetFrame from "../grid/WidgetFrame";
import { useMetric } from "../api/hooks";
import Timeseries, { type TimeseriesPoint } from "./Timeseries";
import Skeleton from "../grid/Skeleton";

export default function ActiveTimeseries({
  app,
  params = {},
  onRemove,
}: {
  app: string;
  params?: any;
  onRemove?: () => void;
}) {
  const q = useMetric("active_timeseries", {
    app,
    range: params.range || "30d",
  });
  const data = ((q.data as any)?.data as TimeseriesPoint[]) || [];
  return (
    <WidgetFrame
      title="Active users"
      onRemove={onRemove}
      error={(q.data as any)?.error || (q.error as any)?.message}
    >
      {q.isLoading && data.length === 0 ? (
        <Skeleton variant="chart" />
      ) : (
        <Timeseries
          data={data}
          color="var(--chart-2)"
          chartType={params.chart_type || "line"}
        />
      )}
    </WidgetFrame>
  );
}

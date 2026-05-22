import WidgetFrame from "../grid/WidgetFrame";
import Skeleton from "../grid/Skeleton";
import { useSqlWidget, useSqlRun } from "../api/sqlWidgets";
import SqlNumber from "./SqlNumber";
import SqlLine from "./SqlLine";
import SqlBar from "./SqlBar";
import SqlTable from "./SqlTable";

type Params = { widget_id?: number; range?: string };

export default function SqlWidget({
  widgetId,
  params = {},
  onRemove,
}: {
  app?: string;
  widgetId?: number;
  params?: Params;
  onRemove?: () => void;
}) {
  const id = widgetId ?? Number(params.widget_id);
  const range = params.range || "30d";
  const meta = useSqlWidget(id);
  const run = useSqlRun(id, range);

  if (meta.isLoading || run.isLoading) {
    return (
      <WidgetFrame title="sql" onRemove={onRemove}>
        <div data-testid="widget-skeleton"><Skeleton variant="block" /></div>
      </WidgetFrame>
    );
  }

  if ((meta.error as any)?.status === 404 || !meta.data) {
    return (
      <WidgetFrame title="sql · deleted" onRemove={onRemove}>
        <div style={{ color: "var(--muted)" }}>Widget deleted</div>
      </WidgetFrame>
    );
  }

  const widget = meta.data;
  const error = run.data?.error;
  const result = run.data?.data;

  return (
    <WidgetFrame title={widget.name} meta={widget.data_source} onRemove={onRemove} error={error}>
      {result ? renderViz(widget.viz, result, widget.options) : null}
    </WidgetFrame>
  );
}

function renderViz(viz: string, result: any, options: any) {
  switch (viz) {
    case "number": return <SqlNumber result={result} options={options} />;
    case "line":   return <SqlLine result={result} options={options} />;
    case "bar":    return <SqlBar result={result} options={options} />;
    case "table":
    default:       return <SqlTable result={result} options={options} />;
  }
}

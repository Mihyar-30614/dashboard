export const WIDGETS = [
  {
    kind: "users_total",
    label: "Users (total)",
    defaultSize: { w: 2, h: 2 },
    scope: "app",
    paramsSchema: [],
  },
  {
    kind: "signups_timeseries",
    label: "Signups over time",
    defaultSize: { w: 6, h: 4 },
    scope: "app",
    paramsSchema: [
      {
        name: "range",
        type: "enum",
        values: ["7d", "30d", "90d"],
        default: "30d",
      },
      {
        name: "chart_type",
        type: "enum",
        values: ["line", "bar", "area"],
        default: "line",
      },
    ],
  },
  {
    kind: "dau",
    label: "DAU",
    defaultSize: { w: 2, h: 2 },
    scope: "app",
    paramsSchema: [],
  },
  {
    kind: "active_timeseries",
    label: "DAU over time",
    defaultSize: { w: 6, h: 4 },
    scope: "app",
    paramsSchema: [
      { name: "range", type: "enum", values: ["7d", "30d"], default: "30d" },
      {
        name: "chart_type",
        type: "enum",
        values: ["line", "bar", "area"],
        default: "line",
      },
    ],
  },
  {
    kind: "health",
    label: "Health",
    defaultSize: { w: 2, h: 2 },
    scope: "both",
    paramsSchema: [],
  },
  {
    kind: "pm2",
    label: "PM2 status",
    defaultSize: { w: 3, h: 2 },
    scope: "both",
    paramsSchema: [],
  },
  {
    kind: "http_rate",
    label: "Requests/sec",
    defaultSize: { w: 4, h: 3 },
    scope: "app",
    paramsSchema: [],
  },
  {
    kind: "http_errors",
    label: "HTTP errors",
    defaultSize: { w: 4, h: 3 },
    scope: "app",
    paramsSchema: [],
  },
  {
    kind: "http_latency",
    label: "p95 latency",
    defaultSize: { w: 4, h: 3 },
    scope: "app",
    paramsSchema: [],
  },
  {
    kind: "kpi",
    label: "KPI value",
    defaultSize: { w: 3, h: 2 },
    scope: "app",
    paramsSchema: [{ name: "key", type: "string", required: true }],
  },
  {
    kind: "kpi_timeseries",
    label: "KPI over time",
    defaultSize: { w: 6, h: 4 },
    scope: "app",
    paramsSchema: [
      { name: "key", type: "string", required: true },
      {
        name: "range",
        type: "enum",
        values: ["7d", "30d", "90d"],
        default: "30d",
      },
      {
        name: "chart_type",
        type: "enum",
        values: ["line", "bar", "area"],
        default: "line",
      },
    ],
  },
  {
    kind: "kpi_sparkline",
    label: "KPI · sparkline",
    defaultSize: { w: 3, h: 2 },
    scope: "app",
    paramsSchema: [
      { name: "key", type: "string", required: true },
      {
        name: "range",
        type: "enum",
        values: ["7d", "30d", "90d"],
        default: "30d",
      },
    ],
  },
  {
    kind: "kpi_delta",
    label: "KPI · delta vs prior",
    defaultSize: { w: 3, h: 2 },
    scope: "app",
    paramsSchema: [
      { name: "key", type: "string", required: true },
      {
        name: "range",
        type: "enum",
        values: ["7d", "30d", "90d"],
        default: "30d",
      },
    ],
  },
  {
    kind: "kpi_target",
    label: "KPI · target",
    defaultSize: { w: 3, h: 2 },
    scope: "app",
    paramsSchema: [
      { name: "key", type: "string", required: true },
      { name: "target", type: "number", required: true },
      {
        name: "direction",
        type: "enum",
        values: ["higher_is_better", "lower_is_better"],
        default: "higher_is_better",
      },
    ],
  },
  {
    kind: "kpi_multistat",
    label: "KPI · multi-stat",
    defaultSize: { w: 6, h: 2 },
    scope: "app",
    paramsSchema: [{ name: "keys", type: "string", required: true }],
  },
];

export const KIND_INDEX = Object.fromEntries(WIDGETS.map((w) => [w.kind, w]));

import type { Row, SavedQuery, SchemaInfo } from "../api/llm";

export type ResultTab = "chart" | "table" | "sql" | "json";

export type QA = {
  id: string;
  question: string;
  answer: string;
  sql: string | null;
  data: Row[];
  count: number;
  warnings: string[] | null;
  related: string[] | null;
  query_id: number | null;
  feedback?: "up" | "down";
  error?: string | null;
  defaultTab: ResultTab;
};

export type AnalyticsState = {
  db: string;
  dbs: string[];
  useCtx: boolean;
  history: QA[];
  pendingId: string | null;
  activeId: string | null;
  activeTab: ResultTab | null;
  saved: SavedQuery[];
  schema: SchemaInfo | null;
  discover: string[];
  railOpen: boolean;
  loadErr: string | null;
};

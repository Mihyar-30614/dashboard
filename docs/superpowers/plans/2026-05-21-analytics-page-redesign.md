# Analytics Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic chat-style Analytics page with a split-focus workspace: left rail (history, discover, saved queries, schema, composer) + right pane with tabbed result (chart, table, SQL, JSON) and auto-picked default tab.

**Architecture:** Decompose the 750-line `web/src/pages/Analytics.tsx` into focused modules under `web/src/analytics/`. Pure utilities (pickTab, csv, formatCell, sql highlight) are TDD'd. Hooks own each remote resource. The page-level orchestrator wires hooks into rail + result-pane shells. CSS moves to a single `analytics.css` reusing existing theme tokens. Backend is unchanged — all needed endpoints already exist on seer.

**Tech Stack:** React 18 + TypeScript, recharts (already installed), vitest + jsdom for tests, existing seer REST endpoints (`/schema`, `/saved-queries`, `/discover`, `/conversation`, `/query`).

**Spec:** `docs/superpowers/specs/2026-05-21-analytics-page-redesign-design.md`

---

## File map

**New:**
- `web/src/analytics/analytics.css` — all redesign styles
- `web/src/analytics/types.ts` — `ResultTab`, `QA`, page state types
- `web/src/analytics/format.ts` — `formatCell`, `toCsv`, `highlightSql`
- `web/src/analytics/result/pickTab.ts` — auto-pick heuristic
- `web/src/analytics/hooks/useDbList.ts`
- `web/src/analytics/hooks/useConversation.ts`
- `web/src/analytics/hooks/useSavedQueries.ts`
- `web/src/analytics/hooks/useSchema.ts`
- `web/src/analytics/rail/LeftRail.tsx`
- `web/src/analytics/rail/RailSection.tsx`
- `web/src/analytics/rail/HistoryList.tsx`
- `web/src/analytics/rail/DiscoverList.tsx`
- `web/src/analytics/rail/SavedList.tsx`
- `web/src/analytics/rail/SchemaTree.tsx`
- `web/src/analytics/rail/Composer.tsx`
- `web/src/analytics/result/ResultPane.tsx`
- `web/src/analytics/result/ChartView.tsx`
- `web/src/analytics/result/TableView.tsx`
- `web/src/analytics/result/SqlView.tsx`
- `web/src/analytics/result/JsonView.tsx`
- `web/src/analytics/result/ResultActions.tsx`
- `web/src/analytics/result/RelatedChips.tsx`
- `web/src/analytics/__tests__/format.test.ts`
- `web/src/analytics/__tests__/pickTab.test.ts`
- `web/vitest.config.ts`
- `web/src/test-setup.ts`

**Modified:**
- `web/src/pages/Analytics.tsx` — replaced with orchestrator (~150 lines)
- `web/src/api/llm.ts` — adds `schema`, `tableSchema`, `savedQueries`, `buildQuery` helper, type exports

---

## Task 1: Vitest + jsdom config

**Files:**
- Create: `web/vitest.config.ts`
- Create: `web/src/test-setup.ts`
- Modify: `web/package.json`
- Create: `web/src/analytics/__tests__/smoke.test.ts`

- [ ] **Step 1: Create vitest config**

Create `web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    globals: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
```

- [ ] **Step 2: Create test setup file**

Create `web/src/test-setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Add a smoke test**

Create `web/src/analytics/__tests__/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("vitest setup", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Verify the test runs**

Run from `web/`:

```bash
npm test
```

Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add web/vitest.config.ts web/src/test-setup.ts web/src/analytics/__tests__/smoke.test.ts
git commit -m "chore(web): vitest jsdom config + setup"
```

---

## Task 2: Types module

**Files:**
- Create: `web/src/analytics/types.ts`

- [ ] **Step 1: Write the types file**

Create `web/src/analytics/types.ts`:

```ts
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
```

> **Note:** `SavedQuery` and `SchemaInfo` will be exported from `api/llm.ts` in Task 5. This file will not type-check until Task 5 is complete. That's fine — we commit it now and run typecheck after Task 5.

- [ ] **Step 2: Commit**

```bash
git add web/src/analytics/types.ts
git commit -m "feat(analytics): types module"
```

---

## Task 3: format.ts — formatCell + toCsv (TDD)

**Files:**
- Create: `web/src/analytics/__tests__/format.test.ts`
- Create: `web/src/analytics/format.ts`

- [ ] **Step 1: Write failing tests for formatCell**

Create `web/src/analytics/__tests__/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatCell, toCsv } from "../format";

describe("formatCell", () => {
  it("renders em-dash for null", () => {
    expect(formatCell(null)).toBe("—");
  });
  it("renders em-dash for undefined", () => {
    expect(formatCell(undefined)).toBe("—");
  });
  it("stringifies objects", () => {
    expect(formatCell({ a: 1 })).toBe('{"a":1}');
  });
  it("stringifies arrays", () => {
    expect(formatCell([1, 2])).toBe("[1,2]");
  });
  it("coerces primitives", () => {
    expect(formatCell(42)).toBe("42");
    expect(formatCell("x")).toBe("x");
    expect(formatCell(true)).toBe("true");
  });
});

describe("toCsv (RFC 4180)", () => {
  it("returns empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });
  it("uses union of keys as header in insertion order", () => {
    const csv = toCsv([{ a: 1 }, { a: 2, b: 3 }]);
    expect(csv.split("\n")[0]).toBe("a,b");
  });
  it("quotes fields containing commas", () => {
    const csv = toCsv([{ a: "hi, there" }]);
    expect(csv).toBe('a\n"hi, there"');
  });
  it("escapes double quotes by doubling them", () => {
    const csv = toCsv([{ a: 'she said "hi"' }]);
    expect(csv).toBe('a\n"she said ""hi"""');
  });
  it("quotes fields with newlines", () => {
    const csv = toCsv([{ a: "line1\nline2" }]);
    expect(csv).toBe('a\n"line1\nline2"');
  });
  it("renders null as empty field", () => {
    const csv = toCsv([{ a: null, b: 1 }]);
    expect(csv).toBe("a,b\n,1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npm test -- format.test`

Expected: FAIL with `Cannot find module '../format'`.

- [ ] **Step 3: Implement format.ts**

Create `web/src/analytics/format.ts`:

```ts
export function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function csvField(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const cols: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k);
        cols.push(k);
      }
    }
  }
  const header = cols.join(",");
  const body = rows
    .map((r) => cols.map((c) => csvField(r[c])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

const SQL_KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER",
  "ON", "AS", "GROUP", "BY", "ORDER", "LIMIT", "OFFSET", "HAVING",
  "AND", "OR", "NOT", "IN", "IS", "NULL", "TRUE", "FALSE",
  "DISTINCT", "UNION", "ALL", "WITH", "CASE", "WHEN", "THEN", "ELSE", "END",
  "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
  "ASC", "DESC", "COUNT", "SUM", "AVG", "MIN", "MAX",
]);

export function highlightSql(sql: string): Array<{ text: string; kw: boolean }> {
  const out: Array<{ text: string; kw: boolean }> = [];
  const re = /[A-Za-z_]+|[^A-Za-z_]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const token = m[0];
    const kw = /^[A-Za-z_]+$/.test(token) && SQL_KEYWORDS.has(token.toUpperCase());
    out.push({ text: token, kw });
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npm test -- format.test`

Expected: all `formatCell` and `toCsv` tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/analytics/format.ts web/src/analytics/__tests__/format.test.ts
git commit -m "feat(analytics): formatCell, toCsv, highlightSql"
```

---

## Task 4: pickTab heuristic (TDD)

**Files:**
- Create: `web/src/analytics/__tests__/pickTab.test.ts`
- Create: `web/src/analytics/result/pickTab.ts`

- [ ] **Step 1: Write failing tests**

Create `web/src/analytics/__tests__/pickTab.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pickTab } from "../result/pickTab";

describe("pickTab", () => {
  it("returns table for 0 rows", () => {
    expect(pickTab([])).toBe("table");
  });
  it("returns table for 1 row × 1 col (metric case rendered inside table)", () => {
    expect(pickTab([{ count: 42 }])).toBe("table");
  });
  it("returns chart for 1 numeric + 1 categorical, small", () => {
    const rows = [
      { region: "EU", users: 100 },
      { region: "US", users: 80 },
      { region: "APAC", users: 60 },
    ];
    expect(pickTab(rows)).toBe("chart");
  });
  it("returns table when categorical+numeric exceeds 30 rows", () => {
    const rows = Array.from({ length: 31 }, (_, i) => ({
      city: `c${i}`,
      n: i,
    }));
    expect(pickTab(rows)).toBe("table");
  });
  it("returns chart (line) when a date column + numeric column present", () => {
    const rows = [
      { day: "2026-01-01", revenue: 100 },
      { day: "2026-01-02", revenue: 120 },
      { day: "2026-01-03", revenue: 90 },
    ];
    expect(pickTab(rows)).toBe("chart");
  });
  it("returns table for all-string columns", () => {
    const rows = [
      { name: "a", desc: "x" },
      { name: "b", desc: "y" },
    ];
    expect(pickTab(rows)).toBe("table");
  });
  it("returns table for 3+ numeric columns without a date", () => {
    const rows = [
      { a: 1, b: 2, c: 3 },
      { a: 4, b: 5, c: 6 },
    ];
    expect(pickTab(rows)).toBe("table");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npm test -- pickTab.test`

Expected: FAIL with `Cannot find module '../result/pickTab'`.

- [ ] **Step 3: Implement pickTab.ts**

Create `web/src/analytics/result/pickTab.ts`:

```ts
import type { ResultTab } from "../types";

type Row = Record<string, unknown>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}|$)/;

function isNumericCol(rows: Row[], col: string): boolean {
  let seen = 0;
  for (const r of rows) {
    const v = r[col];
    if (v === null || v === undefined) continue;
    if (typeof v === "number" && Number.isFinite(v)) {
      seen++;
      continue;
    }
    return false;
  }
  return seen > 0;
}

function isDateCol(rows: Row[], col: string): boolean {
  let seen = 0;
  for (const r of rows) {
    const v = r[col];
    if (v === null || v === undefined) continue;
    if (v instanceof Date) {
      seen++;
      continue;
    }
    if (typeof v === "string" && DATE_RE.test(v)) {
      seen++;
      continue;
    }
    return false;
  }
  return seen > 0;
}

function isCategoricalCol(rows: Row[], col: string): boolean {
  for (const r of rows) {
    const v = r[col];
    if (v === null || v === undefined) continue;
    if (typeof v !== "string") return false;
  }
  return true;
}

export function pickTab(rows: Row[]): ResultTab {
  if (rows.length === 0) return "table";

  const cols = Array.from(
    rows.reduce<Set<string>>((s, r) => {
      for (const k of Object.keys(r)) s.add(k);
      return s;
    }, new Set()),
  );

  if (rows.length === 1 && cols.length === 1) return "table";

  const numericCols = cols.filter((c) => isNumericCol(rows, c));
  const dateCols = cols.filter((c) => isDateCol(rows, c));

  if (numericCols.length >= 1 && dateCols.length >= 1) return "chart";

  if (cols.length === 2 && numericCols.length === 1 && rows.length <= 30) {
    const otherCol = cols.find((c) => c !== numericCols[0])!;
    if (isCategoricalCol(rows, otherCol)) return "chart";
  }

  return "table";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npm test -- pickTab.test`

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/analytics/result/pickTab.ts web/src/analytics/__tests__/pickTab.test.ts
git commit -m "feat(analytics): pickTab heuristic"
```

---

## Task 5: api/llm.ts — schema + savedQueries

**Files:**
- Modify: `web/src/api/llm.ts`

- [ ] **Step 1: Read the current file**

Open `web/src/api/llm.ts` to confirm the current `llm` export shape and `Row` type.

- [ ] **Step 2: Add new types**

Add after the existing `Row` and before `QueryResult`:

```ts
export type SchemaInfo = {
  db_name: string;
  tables: string[];
  schemas: Record<
    string,
    Array<{ name: string; type: string; nullable?: boolean }>
  >;
};

export type SavedQuery = {
  id: number;
  name: string;
  question?: string | null;
  sql_query: string;
  description?: string | null;
  tags?: string[] | null;
  parameters?: Record<string, unknown> | null;
  is_public?: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
};

export type SavedQueryRequest = {
  name: string;
  sql_query: string;
  question?: string | null;
  description?: string | null;
  tags?: string[] | null;
  parameters?: Record<string, unknown> | null;
  is_public?: boolean;
  shared_with_users?: string[] | null;
  shared_with_teams?: string[] | null;
};

export type SavedQueryUpdateRequest = Partial<
  Pick<SavedQueryRequest, "name" | "description" | "tags" | "sql_query" | "parameters">
>;
```

- [ ] **Step 3: Add buildQuery helper**

Add immediately after the `db()` helper:

```ts
function buildQuery(
  opts?: Record<string, string | number | boolean | string[] | undefined>,
): string {
  if (!opts) return "";
  const parts: string[] = [];
  for (const [k, v] of Object.entries(opts)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      for (const item of v) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(item))}`);
    } else {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}
```

- [ ] **Step 4: Extend the `llm` export**

Inside the existing `export const llm = { ... }`, after the `feedback` method add:

```ts
schema: (db_name: string) =>
  req<SchemaInfo>("GET", `${db(db_name)}/schema`),

tableSchema: (db_name: string, table: string) =>
  req<{ db_name: string; table_name: string; schema: unknown }>(
    "GET",
    `${db(db_name)}/schema/${encodeURIComponent(table)}`,
  ),

savedQueries: {
  list: (
    db_name: string,
    opts?: { search_term?: string; tags?: string[]; limit?: number; offset?: number },
  ) =>
    req<{ db_name: string; queries: SavedQuery[]; count: number }>(
      "GET",
      `${db(db_name)}/saved-queries${buildQuery(opts)}`,
    ),
  get: (db_name: string, id: number) =>
    req<{ db_name: string; query: SavedQuery }>(
      "GET",
      `${db(db_name)}/saved-queries/${id}`,
    ),
  create: (db_name: string, body: SavedQueryRequest) =>
    req<{ db_name: string; query_id: number; message: string }>(
      "POST",
      `${db(db_name)}/saved-queries`,
      body,
    ),
  update: (db_name: string, id: number, body: SavedQueryUpdateRequest) =>
    req<{ db_name: string; query_id: number; message: string }>(
      "PUT",
      `${db(db_name)}/saved-queries/${id}`,
      body,
    ),
  delete: (db_name: string, id: number) =>
    req<{ db_name: string; query_id: number; message: string }>(
      "DELETE",
      `${db(db_name)}/saved-queries/${id}`,
    ),
  execute: (
    db_name: string,
    id: number,
    parameters?: Record<string, unknown>,
  ) =>
    req<{
      db_name: string;
      query_id: number;
      result: { data: Row[]; count: number; error: string | null };
    }>(
      "POST",
      `${db(db_name)}/saved-queries/${id}/execute`,
      { parameters: parameters ?? {} },
    ),
},
```

- [ ] **Step 5: Type-check**

Run from `web/`:

```bash
npx tsc -b --noEmit
```

Expected: no errors. (Confirms Task 2's `types.ts` imports also resolve.)

- [ ] **Step 6: Commit**

```bash
git add web/src/api/llm.ts
git commit -m "feat(api): schema + saved-queries client"
```

---

## Task 6: useDbList hook

**Files:**
- Create: `web/src/analytics/hooks/useDbList.ts`

- [ ] **Step 1: Implement**

Create `web/src/analytics/hooks/useDbList.ts`:

```ts
import { useEffect, useState } from "react";
import { llm } from "../../api/llm";

export type UseDbList = {
  dbs: string[];
  loadErr: string | null;
};

export function useDbList(): UseDbList {
  const [dbs, setDbs] = useState<string[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    llm
      .listDatabases()
      .then((r) => {
        if (!cancelled) setDbs(r.databases);
      })
      .catch((e) => {
        if (!cancelled) setLoadErr(String((e as Error)?.message ?? e));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { dbs, loadErr };
}
```

- [ ] **Step 2: Type-check**

Run from `web/`: `npx tsc -b --noEmit`. Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/analytics/hooks/useDbList.ts
git commit -m "feat(analytics): useDbList hook"
```

---

## Task 7: useConversation hook

**Files:**
- Create: `web/src/analytics/hooks/useConversation.ts`

- [ ] **Step 1: Implement**

Create `web/src/analytics/hooks/useConversation.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import { llm, type ConversationTurn } from "../../api/llm";
import type { QA } from "../types";
import { pickTab } from "../result/pickTab";

function uid() {
  return "qa_" + Math.random().toString(36).slice(2, 9);
}

function turnToQA(t: ConversationTurn): QA | null {
  const question = typeof t.question === "string" ? t.question : "";
  if (!question) return null;
  return {
    id: uid(),
    question,
    answer: typeof t.answer === "string" ? t.answer : "",
    sql: typeof t.sql === "string" ? t.sql : null,
    data: [],
    count: 0,
    warnings: null,
    related: null,
    query_id: null,
    defaultTab: pickTab([]),
  };
}

export type UseConversation = {
  history: QA[];
  setHistory: React.Dispatch<React.SetStateAction<QA[]>>;
  clear: () => Promise<void>;
  reloadErr: string | null;
};

export function useConversation(db: string): UseConversation {
  const [history, setHistory] = useState<QA[]>([]);
  const [reloadErr, setReloadErr] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    llm
      .getConversation(db)
      .then((r) => {
        if (cancelled) return;
        const next = (r.history ?? [])
          .map(turnToQA)
          .filter((q): q is QA => q !== null);
        setHistory(next);
      })
      .catch((e) => {
        if (!cancelled) setReloadErr(String((e as Error)?.message ?? e));
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const clear = useCallback(async () => {
    if (!db) return;
    await llm.clearConversation(db);
    setHistory([]);
  }, [db]);

  return { history, setHistory, clear, reloadErr };
}
```

- [ ] **Step 2: Type-check**

Run from `web/`: `npx tsc -b --noEmit`. Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/analytics/hooks/useConversation.ts
git commit -m "feat(analytics): useConversation hook"
```

---

## Task 8: useSavedQueries hook

**Files:**
- Create: `web/src/analytics/hooks/useSavedQueries.ts`

- [ ] **Step 1: Implement**

Create `web/src/analytics/hooks/useSavedQueries.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import { llm, type SavedQuery, type SavedQueryRequest } from "../../api/llm";

export type UseSavedQueries = {
  saved: SavedQuery[];
  reload: () => Promise<void>;
  create: (body: SavedQueryRequest) => Promise<number>;
  remove: (id: number) => Promise<void>;
  execute: (id: number) => Promise<{ data: Array<Record<string, unknown>>; count: number; error: string | null }>;
  err: string | null;
};

export function useSavedQueries(db: string): UseSavedQueries {
  const [saved, setSaved] = useState<SavedQuery[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!db) {
      setSaved([]);
      return;
    }
    try {
      const r = await llm.savedQueries.list(db);
      setSaved(r.queries ?? []);
      setErr(null);
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    }
  }, [db]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(
    async (body: SavedQueryRequest) => {
      if (!db) throw new Error("no database selected");
      const r = await llm.savedQueries.create(db, body);
      await reload();
      return r.query_id;
    },
    [db, reload],
  );

  const remove = useCallback(
    async (id: number) => {
      if (!db) return;
      await llm.savedQueries.delete(db, id);
      await reload();
    },
    [db, reload],
  );

  const execute = useCallback(
    async (id: number) => {
      if (!db) throw new Error("no database selected");
      const r = await llm.savedQueries.execute(db, id);
      return r.result;
    },
    [db],
  );

  return { saved, reload, create, remove, execute, err };
}
```

- [ ] **Step 2: Type-check**

Run from `web/`: `npx tsc -b --noEmit`. Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/analytics/hooks/useSavedQueries.ts
git commit -m "feat(analytics): useSavedQueries hook"
```

---

## Task 9: useSchema hook (lazy)

**Files:**
- Create: `web/src/analytics/hooks/useSchema.ts`

- [ ] **Step 1: Implement**

Create `web/src/analytics/hooks/useSchema.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import { llm, type SchemaInfo } from "../../api/llm";

export type UseSchema = {
  schema: SchemaInfo | null;
  loading: boolean;
  err: string | null;
  load: () => void;
};

export function useSchema(db: string, enabled: boolean): UseSchema {
  const [schema, setSchema] = useState<SchemaInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const load = useCallback(() => {
    setTrigger((t) => t + 1);
  }, []);

  useEffect(() => {
    setSchema(null);
    setErr(null);
  }, [db]);

  useEffect(() => {
    if (!enabled || !db) return;
    if (schema !== null) return;
    let cancelled = false;
    setLoading(true);
    llm
      .schema(db)
      .then((r) => {
        if (!cancelled) setSchema(r);
      })
      .catch((e) => {
        if (!cancelled) setErr(String((e as Error)?.message ?? e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, db, schema, trigger]);

  return { schema, loading, err, load };
}
```

- [ ] **Step 2: Type-check**

Run from `web/`: `npx tsc -b --noEmit`. Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/src/analytics/hooks/useSchema.ts
git commit -m "feat(analytics): useSchema hook (lazy)"
```

---

## Task 10: analytics.css base styles

**Files:**
- Create: `web/src/analytics/analytics.css`

- [ ] **Step 1: Write the stylesheet**

Create `web/src/analytics/analytics.css`:

```css
/* === Analytics page layout === */

.an {
  display: grid;
  grid-template-columns: 280px 1fr;
  grid-template-rows: auto 1fr;
  grid-template-areas:
    "header header"
    "rail   result";
  gap: 18px;
  height: 100%;
  min-height: 0;
}

.an__header {
  grid-area: header;
  display: flex;
  align-items: baseline;
  gap: 24px;
}

.an__header-tools {
  margin-left: auto;
  display: flex;
  gap: 12px;
  align-items: center;
}

.an__db-select {
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--rule);
  border-radius: 4px;
  padding: 6px 10px;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.an__ctx {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
  cursor: pointer;
}

.an__hamburger {
  display: none;
}

/* === Left rail === */

.an-rail {
  grid-area: rail;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid var(--rule);
  border-radius: 8px;
  background: var(--panel);
  padding: 12px;
  min-height: 0;
  overflow: hidden;
}

.an-rail__sections {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.an-rail__section > summary {
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.an-rail__section > summary::-webkit-details-marker { display: none; }

.an-rail__section-body {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.an-rail__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--ink-soft);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  line-height: 1.3;
  width: 100%;
}
.an-rail__item:hover {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent) 25%, var(--rule));
  color: var(--text);
  transform: none;
}
.an-rail__item.is-active {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--rule));
  color: var(--text);
}

.an-rail__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex: 0 0 auto;
}

.an-rail__count {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--muted);
}

.an-rail__empty {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 4px 8px;
}

/* === Composer === */

.an-composer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid var(--rule);
  padding-top: 10px;
}
.an-composer textarea {
  resize: vertical;
  min-height: 54px;
  max-height: 200px;
  padding: 10px 12px;
  background: var(--bg-elev);
  color: var(--text);
  border: 1px solid var(--rule);
  border-radius: 6px;
  font-family: var(--font-ui);
  font-size: 14px;
  line-height: 1.4;
}
.an-composer__row {
  display: flex;
  justify-content: flex-end;
}

/* === Schema tree === */

.an-schema__table {
  display: flex;
  flex-direction: column;
}
.an-schema__cols {
  margin-left: 14px;
  display: flex;
  flex-direction: column;
}
.an-schema__col {
  padding: 4px 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  border-radius: 4px;
}
.an-schema__col:hover {
  color: var(--text);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
.an-schema__col-type {
  color: var(--accent);
  margin-left: 6px;
}

/* === Result pane === */

.an-result {
  grid-area: result;
  display: flex;
  flex-direction: column;
  gap: 14px;
  border: 1px solid var(--rule);
  border-radius: 8px;
  background: var(--panel);
  padding: 18px;
  min-height: 0;
}

.an-result__q {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 15px;
  line-height: 1.4;
}
.an-result__q-label,
.an-result__a-label {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
  flex: 0 0 auto;
}
.an-result__a {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ink-soft);
}

.an-result__tabs {
  display: flex;
  align-items: center;
  gap: 14px;
  border-bottom: 1px solid var(--rule);
  padding-bottom: 8px;
}
.an-result__tab {
  background: transparent;
  border: none;
  padding: 4px 2px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
}
.an-result__tab.is-active {
  color: var(--text);
  border-bottom-color: var(--accent);
}
.an-result__tab:hover {
  color: var(--text);
  background: transparent;
  transform: none;
}

.an-result__actions {
  margin-left: auto;
  display: flex;
  gap: 6px;
  align-items: center;
}

.an-result__body {
  flex: 1;
  min-height: 200px;
  overflow: auto;
}

.an-result__metric {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 20px 0;
}

.an-result__placeholder {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 20px 0;
}

.an-result__error {
  color: var(--bad);
  background: color-mix(in srgb, var(--bad) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--bad) 30%, transparent);
  border-radius: 6px;
  padding: 10px 14px;
  font-family: var(--font-mono);
  font-size: 12px;
}

/* === Table view === */

.an-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-mono);
  font-size: 12px;
}
.an-table th {
  position: sticky;
  top: 0;
  background: var(--panel);
  border-bottom: 1px solid var(--rule);
  padding: 6px 10px;
  text-align: left;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 500;
  cursor: pointer;
  user-select: none;
}
.an-table th .an-table__sort {
  margin-left: 4px;
  color: var(--accent);
}
.an-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--rule);
  vertical-align: top;
  white-space: pre-wrap;
  word-break: break-word;
  max-width: 320px;
}

/* === SQL view === */

.an-sql {
  margin: 0;
  padding: 12px;
  background: color-mix(in srgb, var(--text) 4%, transparent);
  border: 1px solid var(--rule);
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 12px;
  overflow-x: auto;
  white-space: pre;
}
.an-sql__kw { font-weight: 600; color: var(--accent); }

/* === JSON view === */

.an-json {
  margin: 0;
  padding: 12px;
  font-family: var(--font-mono);
  font-size: 12px;
  background: color-mix(in srgb, var(--text) 4%, transparent);
  border: 1px solid var(--rule);
  border-radius: 6px;
  overflow: auto;
}

/* === Related chips === */

.an-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.an-chip {
  padding: 4px 10px;
  background: transparent;
  border: 1px solid var(--rule);
  border-radius: 999px;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
}
.an-chip:hover {
  border-color: var(--accent);
  color: var(--text);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  transform: none;
}

/* === Save form === */

.an-save-form {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 10px;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--bg-elev);
}
.an-save-form input[type="text"] {
  padding: 6px 8px;
  font-size: 12px;
}
.an-save-form__row {
  display: flex;
  gap: 8px;
  align-items: center;
  grid-column: 1 / -1;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}

/* === Skeleton placeholders for pending state === */

.an-skeleton {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.an-skeleton__bar {
  height: 14px;
  border-radius: 4px;
}

/* === Narrow viewport: rail becomes drawer === */

@media (max-width: 899px) {
  .an {
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "result";
  }
  .an__hamburger { display: inline-flex; }
  .an-rail {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 280px;
    z-index: 50;
    transform: translateX(-100%);
    transition: transform 200ms ease;
    box-shadow: 4px 0 24px rgba(0,0,0,0.15);
  }
  .an-rail.is-open { transform: translateX(0); }
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/analytics/analytics.css
git commit -m "feat(analytics): base stylesheet"
```

---

## Task 11: RailSection component

**Files:**
- Create: `web/src/analytics/rail/RailSection.tsx`

- [ ] **Step 1: Implement**

Create `web/src/analytics/rail/RailSection.tsx`:

```tsx
import { type ReactNode, useState } from "react";

export default function RailSection({
  title,
  count,
  defaultOpen = true,
  actions,
  onToggle,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  actions?: ReactNode;
  onToggle?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      className="an-rail__section"
      open={open}
      onToggle={(e) => {
        const next = (e.currentTarget as HTMLDetailsElement).open;
        setOpen(next);
        onToggle?.(next);
      }}
    >
      <summary>
        <span className="eyebrow" style={{ flex: 1 }}>
          {title}
        </span>
        {typeof count === "number" && (
          <span className="an-rail__count">{count}</span>
        )}
        {actions}
      </summary>
      <div className="an-rail__section-body">{children}</div>
    </details>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/analytics/rail/RailSection.tsx
git commit -m "feat(analytics): RailSection component"
```

---

## Task 12: Composer component

**Files:**
- Create: `web/src/analytics/rail/Composer.tsx`

- [ ] **Step 1: Implement**

Create `web/src/analytics/rail/Composer.tsx`:

```tsx
import { forwardRef, type KeyboardEvent } from "react";

export type ComposerProps = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  sending?: boolean;
};

const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  { value, onChange, onSubmit, disabled, placeholder, sending },
  ref,
) {
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };
  return (
    <div className="an-composer">
      <textarea
        ref={ref}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        placeholder={placeholder ?? "Ask a question…"}
        disabled={disabled}
      />
      <div className="an-composer__row">
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !value.trim() || sending}
        >
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
});

export default Composer;
```

- [ ] **Step 2: Commit**

```bash
git add web/src/analytics/rail/Composer.tsx
git commit -m "feat(analytics): Composer component"
```

---

## Task 13: HistoryList component

**Files:**
- Create: `web/src/analytics/rail/HistoryList.tsx`

- [ ] **Step 1: Implement**

Create `web/src/analytics/rail/HistoryList.tsx`:

```tsx
import type { QA } from "../types";

export default function HistoryList({
  history,
  activeId,
  onPick,
}: {
  history: QA[];
  activeId: string | null;
  onPick: (id: string) => void;
}) {
  if (history.length === 0) {
    return <div className="an-rail__empty">No questions yet.</div>;
  }
  // newest first
  const items = [...history].reverse();
  return (
    <>
      {items.map((qa) => (
        <button
          key={qa.id}
          type="button"
          className={
            "an-rail__item" + (qa.id === activeId ? " is-active" : "")
          }
          onClick={() => onPick(qa.id)}
          title={qa.question}
        >
          {qa.id === activeId && <span className="an-rail__dot" />}
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {qa.question}
          </span>
        </button>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/analytics/rail/HistoryList.tsx
git commit -m "feat(analytics): HistoryList component"
```

---

## Task 14: DiscoverList component

**Files:**
- Create: `web/src/analytics/rail/DiscoverList.tsx`

- [ ] **Step 1: Implement**

Create `web/src/analytics/rail/DiscoverList.tsx`:

```tsx
export default function DiscoverList({
  questions,
  onPick,
}: {
  questions: string[];
  onPick: (q: string) => void;
}) {
  if (questions.length === 0) {
    return <div className="an-rail__empty">No suggestions.</div>;
  }
  return (
    <>
      {questions.map((q) => (
        <button
          key={q}
          type="button"
          className="an-rail__item"
          onClick={() => onPick(q)}
          title={q}
        >
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {q}
          </span>
        </button>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/analytics/rail/DiscoverList.tsx
git commit -m "feat(analytics): DiscoverList component"
```

---

## Task 15: SavedList component

**Files:**
- Create: `web/src/analytics/rail/SavedList.tsx`

- [ ] **Step 1: Implement**

Create `web/src/analytics/rail/SavedList.tsx`:

```tsx
import type { SavedQuery } from "../../api/llm";

export default function SavedList({
  saved,
  onPick,
  onDelete,
}: {
  saved: SavedQuery[];
  onPick: (q: SavedQuery) => void;
  onDelete: (id: number) => void;
}) {
  if (saved.length === 0) {
    return <div className="an-rail__empty">No saved queries.</div>;
  }
  return (
    <>
      {saved.map((q) => (
        <div
          key={q.id}
          className="an-rail__item"
          style={{ display: "flex", gap: 6 }}
        >
          <span style={{ color: "var(--accent)" }}>★</span>
          <button
            type="button"
            onClick={() => onPick(q)}
            title={q.description ?? q.name}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: "inherit",
              padding: 0,
              textAlign: "left",
              cursor: "pointer",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {q.name}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete saved query "${q.name}"?`)) onDelete(q.id);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--muted)",
              padding: "0 4px",
              cursor: "pointer",
            }}
            title="Delete"
          >
            ×
          </button>
        </div>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/analytics/rail/SavedList.tsx
git commit -m "feat(analytics): SavedList component"
```

---

## Task 16: SchemaTree component (lazy)

**Files:**
- Create: `web/src/analytics/rail/SchemaTree.tsx`

- [ ] **Step 1: Implement**

Create `web/src/analytics/rail/SchemaTree.tsx`:

```tsx
import { useState } from "react";
import type { SchemaInfo } from "../../api/llm";

export default function SchemaTree({
  schema,
  loading,
  err,
  onColumnClick,
}: {
  schema: SchemaInfo | null;
  loading: boolean;
  err: string | null;
  onColumnClick: (insertion: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (err) return <div className="an-rail__empty">Schema error: {err}</div>;
  if (loading) return <div className="an-rail__empty">Loading schema…</div>;
  if (!schema) return <div className="an-rail__empty">No schema loaded.</div>;

  const toggle = (t: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  return (
    <>
      {schema.tables.map((t) => (
        <div key={t} className="an-schema__table">
          <button
            type="button"
            className="an-rail__item"
            onClick={() => toggle(t)}
          >
            <span style={{ flex: 1 }}>
              {expanded.has(t) ? "▾" : "▸"} {t}
            </span>
          </button>
          {expanded.has(t) && (
            <div className="an-schema__cols">
              {(schema.schemas[t] ?? []).map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className="an-schema__col"
                  onClick={() => onColumnClick(`${t}.${c.name}`)}
                  title={`${t}.${c.name} (${c.type})`}
                >
                  {c.name}
                  <span className="an-schema__col-type">{c.type}</span>
                </button>
              ))}
              {(schema.schemas[t] ?? []).length === 0 && (
                <div className="an-rail__empty">No columns.</div>
              )}
            </div>
          )}
        </div>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/analytics/rail/SchemaTree.tsx
git commit -m "feat(analytics): SchemaTree component"
```

---

## Task 17: LeftRail container

**Files:**
- Create: `web/src/analytics/rail/LeftRail.tsx`

- [ ] **Step 1: Implement**

Create `web/src/analytics/rail/LeftRail.tsx`:

```tsx
import { type ReactNode } from "react";

export default function LeftRail({
  isOpen,
  onClose,
  sections,
  composer,
}: {
  isOpen: boolean;
  onClose: () => void;
  sections: ReactNode;
  composer: ReactNode;
}) {
  return (
    <>
      <aside className={"an-rail" + (isOpen ? " is-open" : "")}>
        <div className="an-rail__sections">{sections}</div>
        {composer}
      </aside>
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            zIndex: 40,
            display: "none",
          }}
          className="an-rail__backdrop"
        />
      )}
    </>
  );
}
```

> Backdrop is `display: none` by default; reveal it in CSS only at narrow viewports. Add to `analytics.css`:

```css
@media (max-width: 899px) {
  .an-rail__backdrop { display: block !important; }
}
```

- [ ] **Step 2: Update analytics.css**

Append the media-query rule above to `web/src/analytics/analytics.css`.

- [ ] **Step 3: Commit**

```bash
git add web/src/analytics/rail/LeftRail.tsx web/src/analytics/analytics.css
git commit -m "feat(analytics): LeftRail container + drawer backdrop"
```

---

## Task 18: TableView (sortable)

**Files:**
- Create: `web/src/analytics/result/TableView.tsx`

- [ ] **Step 1: Implement**

Create `web/src/analytics/result/TableView.tsx`:

```tsx
import { useMemo, useState } from "react";
import { formatCell } from "../format";

type Row = Record<string, unknown>;
type SortDir = "asc" | "desc" | null;

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export default function TableView({ rows }: { rows: Row[] }) {
  const cols = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows.slice(0, 50)) for (const k of Object.keys(r)) set.add(k);
    return Array.from(set);
  }, [rows]);

  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const view = useMemo(() => {
    const base = rows.slice(0, 200);
    if (!sortCol || sortDir === null) return base;
    const sorted = [...base].sort((a, b) => compare(a[sortCol], b[sortCol]));
    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [rows, sortCol, sortDir]);

  function clickHeader(c: string) {
    if (sortCol !== c) {
      setSortCol(c);
      setSortDir("asc");
    } else if (sortDir === "asc") setSortDir("desc");
    else if (sortDir === "desc") {
      setSortCol(null);
      setSortDir(null);
    } else setSortDir("asc");
  }

  if (rows.length === 0) {
    return <div className="an-result__placeholder">(no rows)</div>;
  }

  if (rows.length === 1 && cols.length === 1) {
    const v = rows[0][cols[0]];
    return (
      <div className="an-result__metric">
        <span className="eyebrow">{cols[0]}</span>
        <span className="metric metric--xl">{formatCell(v)}</span>
      </div>
    );
  }

  return (
    <table className="an-table">
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c} onClick={() => clickHeader(c)} title="Click to sort">
              {c}
              {sortCol === c && sortDir && (
                <span className="an-table__sort">
                  {sortDir === "asc" ? "▲" : "▼"}
                </span>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {view.map((r, i) => (
          <tr key={i}>
            {cols.map((c) => (
              <td key={c}>{formatCell(r[c])}</td>
            ))}
          </tr>
        ))}
      </tbody>
      {rows.length > 200 && (
        <tfoot>
          <tr>
            <td
              colSpan={cols.length}
              style={{
                padding: "8px 12px",
                color: "var(--muted)",
                fontSize: 11,
              }}
            >
              showing 200 of {rows.length}
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/analytics/result/TableView.tsx
git commit -m "feat(analytics): TableView with sortable headers + metric"
```

---

## Task 19: ChartView (recharts wrapper)

**Files:**
- Create: `web/src/analytics/result/ChartView.tsx`

- [ ] **Step 1: Implement**

Create `web/src/analytics/result/ChartView.tsx`:

```tsx
import { useMemo } from "react";
import {
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

type Row = Record<string, unknown>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function isNumeric(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isDateLike(v: unknown): boolean {
  if (v instanceof Date) return true;
  return typeof v === "string" && DATE_RE.test(v);
}

type Pick =
  | { kind: "bar"; xKey: string; yKey: string }
  | { kind: "line"; xKey: string; yKey: string }
  | null;

function choosePick(rows: Row[]): Pick {
  if (rows.length === 0) return null;
  const cols = Object.keys(rows[0] ?? {});
  if (cols.length < 2) return null;

  const numericCols = cols.filter((c) =>
    rows.every((r) => r[c] === null || r[c] === undefined || isNumeric(r[c])),
  );
  const dateCols = cols.filter((c) =>
    rows.every(
      (r) => r[c] === null || r[c] === undefined || isDateLike(r[c]),
    ),
  );

  if (dateCols.length > 0 && numericCols.length > 0) {
    return { kind: "line", xKey: dateCols[0], yKey: numericCols[0] };
  }
  if (cols.length === 2 && numericCols.length === 1) {
    const xKey = cols.find((c) => c !== numericCols[0])!;
    return { kind: "bar", xKey, yKey: numericCols[0] };
  }
  return null;
}

export default function ChartView({
  rows,
  fallback,
}: {
  rows: Row[];
  fallback: React.ReactNode;
}) {
  const pick = useMemo(() => choosePick(rows), [rows]);

  if (rows.length === 0) {
    return <div className="an-result__placeholder">(no rows)</div>;
  }
  if (!pick) return <>{fallback}</>;

  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue("--chart-1")
    .trim() || "#0f6b66";
  const rule = getComputedStyle(document.documentElement)
    .getPropertyValue("--rule")
    .trim() || "#d9d4c5";
  const panel = getComputedStyle(document.documentElement)
    .getPropertyValue("--panel")
    .trim() || "#fffcf5";

  const tooltipStyle = {
    background: panel,
    border: `1px solid ${rule}`,
    fontFamily: "var(--font-mono)",
    fontSize: 12,
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      {pick.kind === "bar" ? (
        <BarChart data={rows.slice(0, 200)}>
          <CartesianGrid stroke={rule} strokeDasharray="3 3" />
          <XAxis dataKey={pick.xKey} stroke={rule} />
          <YAxis stroke={rule} />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey={pick.yKey} fill={accent} />
        </BarChart>
      ) : (
        <LineChart data={rows.slice(0, 500)}>
          <CartesianGrid stroke={rule} strokeDasharray="3 3" />
          <XAxis dataKey={pick.xKey} stroke={rule} />
          <YAxis stroke={rule} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line
            type="monotone"
            dataKey={pick.yKey}
            stroke={accent}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/analytics/result/ChartView.tsx
git commit -m "feat(analytics): ChartView (recharts bar + line)"
```

---

## Task 20: SqlView component

**Files:**
- Create: `web/src/analytics/result/SqlView.tsx`

- [ ] **Step 1: Implement**

Create `web/src/analytics/result/SqlView.tsx`:

```tsx
import { highlightSql } from "../format";

export default function SqlView({ sql }: { sql: string | null }) {
  if (!sql) {
    return <div className="an-result__placeholder">(no sql)</div>;
  }
  const parts = highlightSql(sql);
  return (
    <pre className="an-sql">
      {parts.map((p, i) =>
        p.kw ? (
          <span key={i} className="an-sql__kw">
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </pre>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/analytics/result/SqlView.tsx
git commit -m "feat(analytics): SqlView with keyword highlight"
```

---

## Task 21: JsonView component

**Files:**
- Create: `web/src/analytics/result/JsonView.tsx`

- [ ] **Step 1: Implement**

Create `web/src/analytics/result/JsonView.tsx`:

```tsx
type Row = Record<string, unknown>;

export default function JsonView({ rows }: { rows: Row[] }) {
  return <pre className="an-json">{JSON.stringify(rows, null, 2)}</pre>;
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/analytics/result/JsonView.tsx
git commit -m "feat(analytics): JsonView component"
```

---

## Task 22: RelatedChips component

**Files:**
- Create: `web/src/analytics/result/RelatedChips.tsx`

- [ ] **Step 1: Implement**

Create `web/src/analytics/result/RelatedChips.tsx`:

```tsx
export default function RelatedChips({
  related,
  onPick,
}: {
  related: string[] | null;
  onPick: (q: string) => void;
}) {
  if (!related || related.length === 0) return null;
  return (
    <div className="an-chips">
      {related.map((q) => (
        <button
          key={q}
          type="button"
          className="an-chip"
          onClick={() => onPick(q)}
        >
          {q}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/analytics/result/RelatedChips.tsx
git commit -m "feat(analytics): RelatedChips component"
```

---

## Task 23: ResultActions component (pin form, copy, csv)

**Files:**
- Create: `web/src/analytics/result/ResultActions.tsx`

- [ ] **Step 1: Implement**

Create `web/src/analytics/result/ResultActions.tsx`:

```tsx
import { useState } from "react";
import type { QA, ResultTab } from "../types";
import type { SavedQueryRequest } from "../../api/llm";
import { toCsv } from "../format";

export default function ResultActions({
  qa,
  activeTab,
  dbName,
  onSave,
  onToast,
}: {
  qa: QA;
  activeTab: ResultTab;
  dbName: string;
  onSave: (body: SavedQueryRequest) => Promise<number>;
  onToast: (msg: string, kind?: "ok" | "err") => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState(qa.question.slice(0, 80));
  const [tags, setTags] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const canCopy = activeTab !== "chart";
  const canCsv = qa.data.length > 0;

  async function copy() {
    let text = "";
    if (activeTab === "sql") text = qa.sql ?? "";
    else if (activeTab === "json") text = JSON.stringify(qa.data, null, 2);
    else if (activeTab === "table") {
      const cols = Array.from(
        qa.data.reduce<Set<string>>((s, r) => {
          for (const k of Object.keys(r)) s.add(k);
          return s;
        }, new Set()),
      );
      const header = cols.join("\t");
      const body = qa.data
        .map((r) => cols.map((c) => String(r[c] ?? "")).join("\t"))
        .join("\n");
      text = `${header}\n${body}`;
    }
    try {
      await navigator.clipboard.writeText(text);
      onToast("Copied", "ok");
    } catch (e) {
      onToast("Copy failed: " + ((e as Error).message ?? "unknown"), "err");
    }
  }

  function download() {
    const csv = toCsv(qa.data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dbName}-${qa.query_id ?? new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !qa.sql) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        sql_query: qa.sql,
        question: qa.question,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        is_public: isPublic,
      });
      onToast("Saved", "ok");
      setShowForm(false);
    } catch (err) {
      onToast("Save failed: " + ((err as Error).message ?? "unknown"), "err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowForm((v) => !v)}
        disabled={!qa.sql}
        title={qa.sql ? "Pin / save" : "No SQL to save"}
      >
        ★ pin
      </button>
      <button type="button" onClick={copy} disabled={!canCopy}>
        copy
      </button>
      <button type="button" onClick={download} disabled={!canCsv}>
        ⬇ csv
      </button>
      {showForm && (
        <form
          className="an-save-form"
          style={{ gridColumn: "1 / -1", marginTop: 10 }}
          onSubmit={save}
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="name"
            required
          />
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="tags (comma)"
          />
          <button type="submit" disabled={saving || !name.trim()}>
            {saving ? "…" : "save"}
          </button>
          <label className="an-save-form__row">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            public
          </label>
        </form>
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/analytics/result/ResultActions.tsx
git commit -m "feat(analytics): ResultActions (pin form, copy, csv)"
```

---

## Task 24: ResultPane composition

**Files:**
- Create: `web/src/analytics/result/ResultPane.tsx`

- [ ] **Step 1: Implement**

Create `web/src/analytics/result/ResultPane.tsx`:

```tsx
import type { QA, ResultTab } from "../types";
import type { SavedQueryRequest } from "../../api/llm";
import TableView from "./TableView";
import ChartView from "./ChartView";
import SqlView from "./SqlView";
import JsonView from "./JsonView";
import RelatedChips from "./RelatedChips";
import ResultActions from "./ResultActions";

const TABS: ResultTab[] = ["chart", "table", "sql", "json"];

export default function ResultPane({
  qa,
  pending,
  activeTab,
  onTabChange,
  onFeedback,
  onRelated,
  onSave,
  onToast,
  dbName,
}: {
  qa: QA | null;
  pending: boolean;
  activeTab: ResultTab;
  onTabChange: (t: ResultTab) => void;
  onFeedback: (correct: boolean) => void;
  onRelated: (q: string) => void;
  onSave: (body: SavedQueryRequest) => Promise<number>;
  onToast: (msg: string, kind?: "ok" | "err") => void;
  dbName: string;
}) {
  if (!qa) {
    return (
      <section className="an-result">
        <div className="an-result__placeholder">
          Pick a question from history, or ask a new one.
        </div>
      </section>
    );
  }

  if (pending) {
    return (
      <section className="an-result">
        <div className="an-result__q">
          <span className="an-result__q-label">Q</span>
          <span>{qa.question}</span>
        </div>
        <div className="an-result__a">
          <span className="an-result__a-label">A</span>
          <span style={{ color: "var(--muted)" }}>thinking…</span>
        </div>
        <div className="an-skeleton">
          <div className="an-skeleton__bar skeleton" style={{ width: "70%" }} />
          <div className="an-skeleton__bar skeleton" style={{ width: "85%" }} />
          <div className="an-skeleton__bar skeleton" style={{ width: "50%" }} />
        </div>
      </section>
    );
  }

  if (qa.error) {
    return (
      <section className="an-result">
        <div className="an-result__q">
          <span className="an-result__q-label">Q</span>
          <span>{qa.question}</span>
        </div>
        <div className="an-result__error">{qa.error}</div>
      </section>
    );
  }

  const body = (() => {
    switch (activeTab) {
      case "chart":
        return (
          <ChartView rows={qa.data} fallback={<TableView rows={qa.data} />} />
        );
      case "table":
        return <TableView rows={qa.data} />;
      case "sql":
        return <SqlView sql={qa.sql} />;
      case "json":
        return <JsonView rows={qa.data} />;
    }
  })();

  return (
    <section className="an-result">
      <div className="an-result__q">
        <span className="an-result__q-label">Q</span>
        <span>{qa.question}</span>
      </div>
      {qa.answer && (
        <div className="an-result__a">
          <span className="an-result__a-label">A</span>
          <span>{qa.answer}</span>
        </div>
      )}

      <div className="an-result__tabs">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={"an-result__tab" + (t === activeTab ? " is-active" : "")}
            onClick={() => onTabChange(t)}
          >
            {t}
          </button>
        ))}
        <div className="an-result__actions">
          <ResultActions
            qa={qa}
            activeTab={activeTab}
            dbName={dbName}
            onSave={onSave}
            onToast={onToast}
          />
        </div>
      </div>

      <div className="an-result__body">{body}</div>

      {qa.warnings && qa.warnings.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 16, color: "var(--muted)", fontSize: 12 }}>
          {qa.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      <RelatedChips related={qa.related} onPick={onRelated} />

      {qa.query_id != null && (
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => onFeedback(true)}
            style={{
              padding: "4px 8px",
              background:
                qa.feedback === "up"
                  ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                  : "transparent",
              border: "1px solid var(--rule)",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            👍
          </button>
          <button
            type="button"
            onClick={() => onFeedback(false)}
            style={{
              padding: "4px 8px",
              background:
                qa.feedback === "down"
                  ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                  : "transparent",
              border: "1px solid var(--rule)",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            👎
          </button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/analytics/result/ResultPane.tsx
git commit -m "feat(analytics): ResultPane composition"
```

---

## Task 25: Analytics page orchestrator (replaces old file)

**Files:**
- Modify: `web/src/pages/Analytics.tsx` (full rewrite)

- [ ] **Step 1: Replace Analytics.tsx**

Replace the entire contents of `web/src/pages/Analytics.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { llm, type QueryResult, type SavedQuery } from "../api/llm";
import { useToast } from "../ui/Toast";
import "../analytics/analytics.css";
import type { QA, ResultTab } from "../analytics/types";
import { pickTab } from "../analytics/result/pickTab";
import { useDbList } from "../analytics/hooks/useDbList";
import { useConversation } from "../analytics/hooks/useConversation";
import { useSavedQueries } from "../analytics/hooks/useSavedQueries";
import { useSchema } from "../analytics/hooks/useSchema";
import LeftRail from "../analytics/rail/LeftRail";
import RailSection from "../analytics/rail/RailSection";
import HistoryList from "../analytics/rail/HistoryList";
import DiscoverList from "../analytics/rail/DiscoverList";
import SavedList from "../analytics/rail/SavedList";
import SchemaTree from "../analytics/rail/SchemaTree";
import Composer from "../analytics/rail/Composer";
import ResultPane from "../analytics/result/ResultPane";

const DB_KEY = "analytics:db";
const CTX_KEY = "analytics:use_context";
const RAIL_KEY = "analytics:rail_open";
const TAB_KEY = (id: number) => `analytics:active_tab:${id}`;

function uid() {
  return "qa_" + Math.random().toString(36).slice(2, 9);
}

export default function Analytics() {
  const toast = useToast();
  const { dbs, loadErr: dbErr } = useDbList();
  const [db, setDb] = useState<string>(
    () => window.localStorage.getItem(DB_KEY) ?? "",
  );
  const [useCtx, setUseCtx] = useState<boolean>(
    () => window.localStorage.getItem(CTX_KEY) !== "0",
  );
  const conv = useConversation(db);
  const saved = useSavedQueries(db);
  const [schemaEnabled, setSchemaEnabled] = useState(false);
  const schemaQ = useSchema(db, schemaEnabled);

  const [input, setInput] = useState("");
  const [discover, setDiscover] = useState<string[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab | null>(null);
  const [railOpen, setRailOpen] = useState<boolean>(
    () => window.localStorage.getItem(RAIL_KEY) === "1",
  );
  const abortRef = useRef<AbortController | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!db && dbs.length) setDb(dbs[0]);
  }, [db, dbs]);
  useEffect(() => {
    if (db) window.localStorage.setItem(DB_KEY, db);
  }, [db]);
  useEffect(() => {
    window.localStorage.setItem(CTX_KEY, useCtx ? "1" : "0");
  }, [useCtx]);
  useEffect(() => {
    window.localStorage.setItem(RAIL_KEY, railOpen ? "1" : "0");
  }, [railOpen]);

  useEffect(() => {
    if (!db) {
      setDiscover([]);
      return;
    }
    llm
      .discover(db, 6)
      .then((r) =>
        setDiscover(
          (r.questions ?? [])
            .map((q) =>
              typeof q === "string" ? q : (q as { question?: string })?.question ?? "",
            )
            .filter(Boolean),
        ),
      )
      .catch(() => setDiscover([]));
  }, [db]);

  const activeQA = useMemo(
    () => conv.history.find((q) => q.id === activeId) ?? null,
    [conv.history, activeId],
  );
  const isPending = activeId !== null && activeId === pendingId;

  const effectiveTab: ResultTab = useMemo(() => {
    if (activeTab) return activeTab;
    return activeQA?.defaultTab ?? "table";
  }, [activeTab, activeQA]);

  useEffect(() => {
    if (!activeQA?.query_id) return;
    const stored = window.localStorage.getItem(TAB_KEY(activeQA.query_id));
    if (stored && ["chart", "table", "sql", "json"].includes(stored)) {
      setActiveTab(stored as ResultTab);
    } else {
      setActiveTab(null);
    }
  }, [activeQA?.query_id]);

  function changeTab(t: ResultTab) {
    setActiveTab(t);
    if (activeQA?.query_id) {
      window.localStorage.setItem(TAB_KEY(activeQA.query_id), t);
    }
  }

  const send = useCallback(
    async (text: string) => {
      if (!db || !text.trim()) return;
      const q = text.trim();
      setInput("");
      const id = uid();
      const draft: QA = {
        id,
        question: q,
        answer: "",
        sql: null,
        data: [],
        count: 0,
        warnings: null,
        related: null,
        query_id: null,
        defaultTab: "table",
      };
      conv.setHistory((h) => [...h, draft]);
      setPendingId(id);
      setActiveId(id);
      setActiveTab(null);
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const r: QueryResult = await llm.query(db, q, useCtx, ac.signal);
        conv.setHistory((h) =>
          h.map((qa) =>
            qa.id === id
              ? {
                  ...qa,
                  answer: r.answer || "",
                  sql: r.sql ?? null,
                  data: r.data ?? [],
                  count: r.count ?? 0,
                  warnings: r.validation_warnings ?? null,
                  related: r.related_questions ?? null,
                  query_id: r.query_id ?? null,
                  error: r.error ?? null,
                  defaultTab: pickTab(r.data ?? []),
                }
              : qa,
          ),
        );
      } catch (e) {
        const msg =
          (e as Error).name === "AbortError"
            ? "Cancelled"
            : String((e as Error)?.message ?? e);
        conv.setHistory((h) =>
          h.map((qa) => (qa.id === id ? { ...qa, error: msg } : qa)),
        );
      } finally {
        setPendingId(null);
      }
    },
    [db, useCtx, conv],
  );

  const executeSaved = useCallback(
    async (sq: SavedQuery) => {
      if (!db) return;
      const id = uid();
      const draft: QA = {
        id,
        question: sq.question || sq.name,
        answer: "",
        sql: sq.sql_query,
        data: [],
        count: 0,
        warnings: null,
        related: null,
        query_id: null,
        defaultTab: "table",
      };
      conv.setHistory((h) => [...h, draft]);
      setPendingId(id);
      setActiveId(id);
      setActiveTab(null);
      try {
        const r = await saved.execute(sq.id);
        if (r.error) throw new Error(r.error);
        conv.setHistory((h) =>
          h.map((qa) =>
            qa.id === id
              ? {
                  ...qa,
                  data: r.data,
                  count: r.count,
                  defaultTab: pickTab(r.data),
                }
              : qa,
          ),
        );
      } catch (e) {
        conv.setHistory((h) =>
          h.map((qa) =>
            qa.id === id
              ? { ...qa, error: String((e as Error)?.message ?? e) }
              : qa,
          ),
        );
      } finally {
        setPendingId(null);
      }
    },
    [db, saved, conv],
  );

  async function feedback(correct: boolean) {
    if (!activeQA?.query_id || !db) return;
    try {
      await llm.feedback(db, activeQA.query_id, correct);
      conv.setHistory((h) =>
        h.map((qa) =>
          qa.id === activeQA.id
            ? { ...qa, feedback: correct ? "up" : "down" }
            : qa,
        ),
      );
    } catch (e) {
      toast.error("Feedback failed: " + ((e as Error)?.message ?? "unknown"));
    }
  }

  function insertAtCaret(text: string) {
    const ta = composerRef.current;
    if (!ta) {
      setInput((s) => s + text);
      return;
    }
    const start = ta.selectionStart ?? input.length;
    const end = ta.selectionEnd ?? input.length;
    const next = input.slice(0, start) + text + input.slice(end);
    setInput(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        composerRef.current?.focus();
      } else if (meta && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setRailOpen((v) => !v);
      } else if (e.key === "Escape") {
        if (abortRef.current && pendingId) {
          abortRef.current.abort();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingId]);

  const loadErr = dbErr || conv.reloadErr || saved.err;

  return (
    <div className="an">
      <header className="an__header">
        <button
          type="button"
          className="an__hamburger"
          onClick={() => setRailOpen((v) => !v)}
          aria-label="Toggle rail"
        >
          ☰
        </button>
        <div>
          <span className="eyebrow">analytics · ask your db</span>
          <h1 style={{ marginTop: 6 }}>
            <em
              style={{
                fontStyle: "italic",
                color: "var(--accent)",
                fontWeight: 500,
              }}
            >
              Ask
            </em>{" "}
            anything.
          </h1>
        </div>
        <div className="an__header-tools">
          <label className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            db
            <select
              className="an__db-select"
              value={db}
              onChange={(e) => setDb(e.target.value)}
            >
              {dbs.length === 0 && <option value="">(loading…)</option>}
              {dbs.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="an__ctx">
            <input
              type="checkbox"
              checked={useCtx}
              onChange={(e) => setUseCtx(e.target.checked)}
            />
            context
          </label>
          <button
            type="button"
            onClick={() => conv.clear().then(() => toast.success("Conversation cleared"))}
            disabled={!db}
          >
            Clear
          </button>
        </div>
      </header>

      {loadErr && (
        <div className="an-result__error" style={{ gridColumn: "1 / -1" }}>
          API: {loadErr} · is the analytics API running on {llm.baseUrl}?
        </div>
      )}

      <LeftRail
        isOpen={railOpen}
        onClose={() => setRailOpen(false)}
        sections={
          <>
            <RailSection title="history" count={conv.history.length}>
              <HistoryList
                history={conv.history}
                activeId={activeId}
                onPick={(id) => {
                  setActiveId(id);
                  setActiveTab(null);
                }}
              />
            </RailSection>
            <RailSection title="discover">
              <DiscoverList questions={discover} onPick={send} />
            </RailSection>
            <RailSection title="saved" count={saved.saved.length}>
              <SavedList
                saved={saved.saved}
                onPick={executeSaved}
                onDelete={saved.remove}
              />
            </RailSection>
            <RailSection
              title="schema"
              defaultOpen={false}
              onToggle={(open) => open && setSchemaEnabled(true)}
            >
              <SchemaTree
                schema={schemaQ.schema}
                loading={schemaQ.loading}
                err={schemaQ.err}
                onColumnClick={insertAtCaret}
              />
            </RailSection>
          </>
        }
        composer={
          <Composer
            ref={composerRef}
            value={input}
            onChange={setInput}
            onSubmit={() => send(input)}
            disabled={!db}
            sending={pendingId !== null}
            placeholder={
              db ? "Ask a question about " + db + "…" : "Select a database to start"
            }
          />
        }
      />

      <ResultPane
        qa={activeQA}
        pending={isPending}
        activeTab={effectiveTab}
        onTabChange={changeTab}
        onFeedback={feedback}
        onRelated={send}
        onSave={async (body) => {
          const id = await saved.create(body);
          return id;
        }}
        onToast={(msg, kind) => {
          if (kind === "err") toast.error(msg);
          else toast.success(msg);
        }}
        dbName={db}
      />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run from `web/`: `npx tsc -b --noEmit`. Expected: no errors.

- [ ] **Step 3: Build**

Run from `web/`: `npm run build`. Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/Analytics.tsx
git commit -m "feat(analytics): split-focus orchestrator replaces chat page"
```

---

## Task 26: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Confirm the seer backend is running on port 4110 (the vite proxy target). Then from `web/`:

```bash
npm run dev
```

Open `http://localhost:4210/analytics`.

- [ ] **Step 2: Smoke test the golden path**

Verify in browser:

1. Header shows db selector + context toggle + clear.
2. Left rail shows history, discover, saved, schema sections (each collapsible).
3. Schema is empty until expanded; expanding triggers the GET `/schema` request (check DevTools Network tab).
4. Ask a question → pending state shows skeleton + "thinking…" → result lands with auto-picked tab.
5. Click each tab (chart, table, sql, json); each renders.
6. Click a column header in `table` tab; sort indicator (▲) appears and rows reorder.
7. Pin: click `★ pin`, fill in name, click save → toast "Saved" → entry appears in saved section.
8. Click a saved entry → executes and pins; SQL view shows the saved SQL.
9. Click `⬇ csv` → file downloads with `{db}-{...}.csv`.
10. Click `copy` on table tab → confirm via DevTools console that clipboard has TSV.
11. Click a discover question → sends and pins result.
12. Click a column in schema tree → composer receives `{table}.{column}` at caret.
13. `Cmd/Ctrl+K` focuses composer; `Esc` aborts in-flight; `Cmd/Ctrl+B` no-op at desktop width.
14. Resize window below 900px → rail collapses; hamburger toggles drawer; backdrop click closes drawer.
15. Refresh page → selected db, context toggle, and rail-open state persist via localStorage.

- [ ] **Step 3: Edge cases**

1. Ask a question against an empty table (returns 0 rows) → tabs visible, table/chart show `(no rows)`, json shows `[]`.
2. Ask a question that errors at SQL level → error card replaces body, question line stays.
3. Result with `validation_warnings` populated → warnings list renders below body.
4. Delete a saved query (`×`) → confirm prompt → entry disappears.

- [ ] **Step 4: Final commit if any tweaks**

If anything broke and you fixed it inline, commit. Otherwise nothing to do.

---

## Self-review notes

Already verified during plan authoring:

- **Spec coverage:** Every section of the spec maps to a task — layout (Task 10, 17, 25), left rail content (Tasks 11-17, 25), result pane + tabs + auto-pick (Tasks 4, 18-22, 24), actions (Task 23), state + send flow (Task 25), keyboard + persistence (Task 25), API additions (Task 5), file structure (all tasks).
- **Placeholder scan:** No "TBD" / "appropriate error handling" stubs. Each step has the actual code or command needed.
- **Type consistency:** `QA`, `ResultTab`, `SavedQuery`, `SchemaInfo` names are consistent across tasks. `pickTab` signature matches usage in Task 25. `useConversation.setHistory` is the same React setter pattern called from Task 25's `send`.
- **One known forward dependency:** Task 2 (`types.ts`) imports from Task 5's additions to `api/llm.ts`. Type-check is deferred until Task 5 completes (called out inline in Task 2).

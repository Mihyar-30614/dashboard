# Analytics Page Redesign — Split-Focus Workspace

**Date:** 2026-05-21
**Status:** Approved (design phase)
**Scope:** `web/src/pages/Analytics.tsx` and supporting modules
**Out of scope:** Backend changes (existing seer endpoints sufficient), other pages

## Problem

The current Analytics page is a single 750-line file with inline styles that renders ask-the-database as a generic chat scroll:

- One full-height scroll box of chat bubbles — no spatial sense of "exploring data."
- SQL and result tables are hidden behind `<details>` elements — power users have to expand every answer to see what ran or what came back.
- Result tables are the only data view. No chart rendering despite this being an analytics surface.
- Discover questions only appear in the empty state. Once the user asks anything, they vanish.
- No persistent saved or pinned queries, despite the seer backend exposing a full saved-queries CRUD with tags, sharing, parameters, and execute.
- No schema browser, despite seer exposing `/schema` and `/schema/{table}`.
- No way to copy results, export to csv, or sort columns.
- Inline styles throughout — not maintainable, no reuse, hard to evolve consistently with the rest of the editorial dashboard.

## Goals

1. Re-anchor the page around an **active result** rather than a chat transcript.
2. Make SQL, table, chart, and JSON views first-class — visible by tab, not buried.
3. Surface discover, history, saved queries, and schema persistently in a left rail.
4. Auto-pick a sensible default tab (chart vs table vs metric) from result shape.
5. Replace inline styles with reusable CSS aligned to existing theme tokens.
6. Split the monolithic file into focused, testable modules.
7. Use existing backend APIs only. No new endpoints.

## Non-Goals

- Multi-tab or multi-pin result views (one active result at a time).
- Query parameterization UI (backend supports it; defer to a later spec).
- Sharing UI for saved queries beyond `is_public` (no per-user/per-team picker now).
- Manual chart-type picker (auto-pick only).
- Export formats beyond CSV.
- History search/filter UI.
- Mobile-first polish — narrow viewports get a functional drawer fallback, not a tuned experience.

## Layout

Two-pane on viewports `≥ 900px`. Header spans both panes.

```
┌─ header: ask anything · [db ▾] [ctx] [clear] ──────────────┐
├──────────────┬─────────────────────────────────────────────┤
│  LEFT RAIL   │  RESULT PANE (focused on active query)      │
│  280px       │                                             │
│  · history   │  Q · "top users by region"                  │
│  · discover  │  A · 12 regions, EU leads at 482            │
│  · saved     │                                             │
│  · schema    │  [ chart ] table  sql  json   ★ pin copy ⬇  │
│              │  ┌─────────────────────────────────────┐    │
│  [ ask… __ ] │  │  result render                      │    │
│      send    │  └─────────────────────────────────────┘    │
└──────────────┴─────────────────────────────────────────────┘
```

- Left rail width: fixed `280px`.
- Composer lives at the **bottom of the left rail**, not the right pane, so the user's eye stays anchored on the result while typing.
- Right pane shows the currently active Q/A. Clicking any history or saved item re-pins.

**Narrow viewport (`< 900px`):** left rail collapses to a drawer behind a hamburger toggle. Right pane fills the full width. Drawer state persists in localStorage.

## Left Rail

Four stacked sections, each a collapsible `<details>`-style block with an eyebrow header. Composer pinned to the bottom.

### History

- Source: `GET /api/databases/{db}/conversation` (existing).
- Lists asked questions in the current conversation, most recent first.
- Active item shows a `●` accent dot.
- Click → pins that Q/A to the right pane (does **not** re-send).
- Hover state uses soft accent background.

### Discover

- Source: `GET /api/databases/{db}/discover?limit=6` (existing).
- Suggested questions for the current database.
- Click → sends as a query (same path as composer submit).
- Visible at all times, not only on empty state.

### Saved

- Source: `GET /api/databases/{db}/saved-queries` (existing).
- Each item shows the saved name + a star icon.
- Section header has a `+` button which surfaces an inline "save current query" form anchored to the active result's `★ pin` action (see Result Pane → Actions).
- Click an item → `POST /api/databases/{db}/saved-queries/{id}/execute`, then synthesize a Q/A object (question = `saved.question || saved.name`, sql = `saved.sql_query`, data = result rows) and pin it.

### Schema

- Source: `GET /api/databases/{db}/schema` (existing), lazy-loaded the first time the section is expanded.
- Tree view: table name → expand → columns with types.
- Click a column → inserts `{table}.{col}` into the composer at the current caret position and focuses the composer.
- Table detail (`GET /api/databases/{db}/schema/{table}`) is **not** required for v1; the bulk `/schema` response carries column info via `schemas`.

### Composer

- Sticky to the bottom of the rail.
- Auto-grows from 2 rows up to 6 rows.
- Disabled when no database is selected.
- `Enter` sends; `Shift+Enter` inserts a newline.
- While a query is in flight, the right pane shows a skeleton; the composer remains enabled so the user can queue the next question by waiting for the previous to land (no client-side queue — sending again aborts the in-flight request via stored AbortController).

## Result Pane

A single active Q/A at a time. Sections from top to bottom:

1. **Question line** — `Q · {question}` in the question style.
2. **Answer line** — `A · {answer}` in body type.
3. **Tab strip + actions row** — `[ chart | table | sql | json ]` on the left, `★ pin · copy · ⬇ csv` on the right.
4. **Body** — renders the active tab.
5. **Warnings** — muted bullet list of `validation_warnings`, if any.
6. **Related chips** — clickable chips from `related_questions`. Click sends.
7. **Feedback** — 👍 👎 buttons, only shown when `query_id` is present.

### Tabs

Default tab is auto-picked from result shape via a pure `pickTab(rows, cols)` function:

| Shape | Default tab |
|-------|-------------|
| 0 rows | `table` (renders `(no rows)` placeholder) |
| 1 row, 1 col | `table` (but body renders the single value as `.metric--xl`, not a table) |
| 2 cols, 1 numeric + 1 categorical, ≤30 rows | `chart` (bar) |
| 2+ cols with a numeric column **and** a date/timestamp column | `chart` (line) |
| anything else | `table` |

The tab strip always shows the same four tabs (`chart | table | sql | json`). The `defaultTab` determines which is initially active; the body of each tab is responsible for rendering sensibly given the data (e.g., `table` renders a metric for the 1×1 case, `chart` falls back to the table view if data turns out unchartable).

The user can override by clicking another tab. The override is stored per `query_id` in localStorage (`analytics:active_tab:{query_id}`) so re-renders and re-pins preserve the choice.

### Chart view

- Uses **recharts** (already in `package.json`).
- Bar and line variants only.
- Colors from CSS variables `--chart-1` through `--chart-6` (theme-aware).
- Tooltip styled with `--panel` background and `--rule` border.
- Legend hidden when single-series.
- Axis labels use the column names.
- If `pickTab` returns chart but the data turns out unchartable at render time (e.g., all-null numeric column), falls back silently to the table view.

### Table view

- Extracted from the current `ResultTable` component into its own file.
- Sticky headers (already present) are preserved.
- New: click a header to sort ascending; click again to sort descending; third click clears the sort.
- Sort is client-side over `rows.slice(0, 200)` (same cap as today).

### SQL view

- Pretty block.
- Lightweight keyword highlighting via regex (`SELECT|FROM|WHERE|JOIN|GROUP|ORDER|LIMIT|...`) — bold accent.
- Copy button.

### JSON view

- `JSON.stringify(rows, null, 2)` in a scrollable `<pre>`.

### Actions

- **★ pin** — opens an inline form (name required; tags as comma-separated; `is_public` checkbox). `POST /saved-queries` with the current `question` and `sql`. On success: refresh saved list, close form, toast.
- **copy** — copies the active tab's content. Table tab copies TSV. SQL tab copies raw SQL. JSON tab copies JSON. Chart tab is disabled (no chart-to-clipboard).
- **⬇ csv** — downloads the full result rows as CSV (RFC 4180 quoting). Filename = `{db}-{query_id || isoDate}.csv`.

### States

- **Pending**: skeleton shimmer fills the body region. Question line shows the in-flight question with a `thinking…` eyebrow. Tabs/actions disabled.
- **Error**: body region replaced with a red card containing the error message. Question line stays. Tabs/actions disabled.
- **Empty result (0 rows)**: all four tabs remain enabled. `table` and `chart` bodies render a muted `(no rows)` placeholder. `sql` and `json` render normally (sql still useful for inspection; json renders `[]`).

## State

```ts
type ResultTab = "chart" | "table" | "sql" | "json";

type QA = {
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
  defaultTab: ResultTab; // auto-picked on arrival
};

type State = {
  db: string;
  dbs: string[];
  useCtx: boolean;
  history: QA[];               // hydrated from getConversation
  pendingId: string | null;    // id of in-flight query
  activeId: string | null;     // which QA is pinned to the right pane
  activeTab: ResultTab | null; // user override; null = use defaultTab
  saved: SavedQuery[];
  schema: SchemaInfo | null;   // lazy
  discover: string[];
  railOpen: boolean;           // drawer state on narrow viewports
  loadErr: string | null;
};
```

State is held in the top-level `Analytics` component via `useState` + four custom hooks:

- `useDbList()` — lists databases once on mount.
- `useConversation(db)` — fetches history when `db` changes, exposes `clear`, `appendQA`, `updateQA`.
- `useSavedQueries(db)` — list + mutations.
- `useSchema(db, enabled)` — lazy-fetches on first expand.

No react-query — the surface is small and self-contained.

### Send flow

1. Push a pending QA onto `history`. Set `pendingId` and `activeId` to the new id. Clear `activeTab` override.
2. `POST /api/databases/{db}/query` with an `AbortController` stored on a ref. If a previous request is in flight, abort it first.
3. On resolve: merge the response onto the pending QA, compute `defaultTab`, clear `pendingId`.
4. On error: mark the QA with `error`, clear `pendingId`. Keep the QA in history so the user can retry.

### Pin existing QA

`setActiveId(qa.id)` and `setActiveTab(null)`. No fetch.

### Execute saved query

`POST /saved-queries/{id}/execute` → synthesize a QA (no LLM answer; `answer = ""`, `question = saved.question || saved.name`, `sql = saved.sql_query`, `data = result.data`, `count = result.count`, `query_id = null`). Append to history. Pin.

### Schema column click

Insert `{table}.{col}` into the composer textarea at the current selection start. Then focus and place the caret immediately after the insertion.

### Keyboard shortcuts

- `Enter` — send (already present).
- `Shift+Enter` — newline (already present).
- `Esc` — abort in-flight request.
- `Cmd/Ctrl+K` — focus composer.
- `Cmd/Ctrl+B` — toggle rail drawer (narrow viewports only).

### LocalStorage persistence

- `analytics:db` — selected database (existing).
- `analytics:use_context` — context toggle (existing).
- `analytics:active_tab:{query_id}` — per-query tab override.
- `analytics:rail_open` — drawer open state on narrow viewports.

## API Additions

Extend `web/src/api/llm.ts`. No new endpoints — all already exist on seer.

```ts
export type SchemaInfo = {
  db_name: string;
  tables: string[];
  schemas: Record<string, Array<{ name: string; type: string; nullable?: boolean }>>;
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

// added inside llm = { ... }
schema: (db_name: string) =>
  req<SchemaInfo>("GET", `${db(db_name)}/schema`),

tableSchema: (db_name: string, table: string) =>
  req<{ db_name: string; table_name: string; schema: unknown }>(
    "GET",
    `${db(db_name)}/schema/${encodeURIComponent(table)}`,
  ),

savedQueries: {
  list: (db_name: string, opts?: { search?: string; tags?: string[]; limit?: number; offset?: number }) =>
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
  execute: (db_name: string, id: number, parameters?: Record<string, unknown>) =>
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

`buildQuery(opts)` is a small local helper that encodes `{ search, tags[], limit, offset }` into a `?…` string (omits empty values). Defined inside `llm.ts`.

**Schema response shape note:** seer returns `schema_info.get('schemas', {})` whose content is produced by `db_engine.get_schema_info()`. The `SchemaInfo.schemas` type above is the expected shape; if the runtime response diverges, normalize in a small adapter inside `useSchema` rather than fanning the unknown shape through the UI.

## File Structure

Current: one 750-line `Analytics.tsx` with inline styles.

New:

```
web/src/pages/Analytics.tsx               # orchestrator (~150 lines)
web/src/analytics/
  ├─ analytics.css                        # all styles, no inline
  ├─ types.ts                             # QA, ResultTab, State, SavedQuery re-exports
  ├─ hooks/
  │   ├─ useDbList.ts
  │   ├─ useConversation.ts
  │   ├─ useSavedQueries.ts
  │   └─ useSchema.ts
  ├─ rail/
  │   ├─ LeftRail.tsx                     # container + drawer logic
  │   ├─ RailSection.tsx                  # collapsible eyebrow section
  │   ├─ HistoryList.tsx
  │   ├─ DiscoverList.tsx
  │   ├─ SavedList.tsx
  │   ├─ SchemaTree.tsx
  │   └─ Composer.tsx
  ├─ result/
  │   ├─ ResultPane.tsx                   # tabs + actions
  │   ├─ pickTab.ts                       # auto-pick heuristic (pure, unit-testable)
  │   ├─ ChartView.tsx                    # recharts wrapper
  │   ├─ TableView.tsx                    # sortable extract of current ResultTable
  │   ├─ SqlView.tsx
  │   ├─ JsonView.tsx
  │   ├─ ResultActions.tsx                # pin form + copy + csv
  │   └─ RelatedChips.tsx
  └─ format.ts                            # formatCell, toCsv, sql highlight
```

Styles go in `analytics.css` with a BEM-ish naming scheme: `.an-rail`, `.an-rail__section`, `.an-result`, `.an-result__tab`, etc. Reuses existing theme tokens (`--accent`, `--panel`, `--rule`, `--muted`, chart vars). No new colors introduced.

## Testing

Unit tests (vitest) for pure functions:

- `pickTab(rows, cols)` — covers all shape cases in the auto-pick table above.
- `toCsv(rows)` — RFC 4180 quoting (commas, quotes, newlines).
- `formatCell(v)` — moved out of the page file; existing behavior preserved.

Component-level tests are out of scope; verify manually in the browser (`run` skill) when implementing.

## Phasing

Ship as one PR with logically ordered commits so a reviewer can follow:

1. **Extract** — move inline styles into `analytics.css`, split the monolith into modules. No behavior change.
2. **API** — add `schema`, `tableSchema`, and `savedQueries` to `llm.ts`. Add hooks.
3. **Layout** — rail + result-pane shells, header refactor, drawer for narrow viewports.
4. **Result tabs** — `pickTab`, `ChartView` (recharts), sortable `TableView`, `SqlView`, `JsonView`.
5. **Rail content** — history, discover, saved (with inline save form), schema (lazy).
6. **Polish** — csv export, sql keyword highlight, keyboard shortcuts, per-query tab persistence.

## Open Risks

- **Schema response shape divergence** — mitigated by an adapter in `useSchema`. If the shape is too far from the typed `SchemaInfo`, escalate to a small backend change (out of scope here).
- **Recharts bundle size** — already in `package.json`, so no new cost.
- **Saved-queries execute returns no `answer` field** — handled by synthesizing a QA with `answer = ""` and treating it as a "saved result" rather than an LLM answer.
- **Aborting in-flight request when sending again** — already the existing behavior; preserved.

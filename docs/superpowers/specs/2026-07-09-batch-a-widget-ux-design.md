# Batch A: sturdier inferViz + widget param editing

Approved 2026-07-09. Two independent features, one batch.

## 1. Sturdier `inferViz` (server)

`server/sqlWidgets.js` `inferViz` picks `line` only when the first column is
literally named `t`. Queries returning `day`, `date`, `created_at`, etc. fall
through to `bar` or `table`.

**Change:** treat the result as a timeseries when the first column's sample
value *looks temporal* — a JS `Date` (pg returns these for `timestamp`/`date`
columns) or a string starting `YYYY-MM-DD` — and at least one later column is
numeric. Keep the existing `t`-name rule. `number`/`bar`/`table` rules
unchanged. Order: number → line (name or temporal value) → bar → table.

**Tests:** date-string first column → line; `Date` object → line; text first
column + numeric second → still bar; single numeric cell → still number.

## 2. Edit widget params after placement (web)

Widgets are added with `params: {}` and there is no UI to change them; the
only recourse is remove + re-add. `config/widgets.json` already declares
`paramsSchema` per kind (enum/string/number fields, defaults, required).

**UX:** gear button in `WidgetFrame`'s header (next to remove) whenever the
widget's kind has a non-empty editable schema. Click opens an inline popover
anchored in the frame with one field per schema entry:

- `enum` → `<select>` with the schema's values
- `number` → numeric input
- `string` → text input

Apply / Cancel buttons. Apply saves via the existing layout autosave path.

**SQL widgets:** only `range` is editable; `widget_id` is managed by the
palette and hidden from the popover.

**Wiring (no per-widget changes):** widget components render their own
`WidgetFrame`, so props can't carry the editing hooks without touching all 16
widgets. Instead `useLayoutPage.renderWidget` wraps each widget in a React
context provider carrying `{ schema, params, onSave }`;
`WidgetFrame` consumes the context. Widgets rendered outside the grid (no
provider) show no gear.

- `web/src/grid/paramsEditing.tsx` — context + `ParamsPopover` form component
- `web/src/widgets/registry.ts` — expose `paramsSchema` on `WidgetDef`
  (already present in `widgets.json`, currently dropped)
- `web/src/grid/useLayoutPage.tsx` — `updateParams(id, params)` →
  `setLocal` + `scheduleSave`; provider in `renderWidget`
- `web/src/grid/WidgetFrame.tsx` — gear button + popover, context-driven

Data refresh is free: `useMetric` query keys include params, so changed
params refetch automatically.

**Tests:** popover renders fields from schema (enum select, string input);
Apply calls `onSave` with edited values; `widget_id` never rendered; no gear
when schema empty or no provider.

## Out of scope

Global time-range picker (Batch B) builds on this param plumbing.

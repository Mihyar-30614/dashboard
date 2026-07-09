# Page redesign: console header + SQL widgets polish

Approved 2026-07-09. Visual/layout only — no functional, API, or data
changes. Theme tokens (`theme.css` palette, fonts, radii, shadows)
untouched; only new usages of existing tokens.

## Problem

Overview / AppPage / Settings share a hero pattern (`.eyebrow` + big
serif `h1` with an italicized accent word, e.g. "Every property, one
pane of glass.") that reads as marketing copy for what's an ops
console. Analytics runs its own separate header/CSS system
(`analytics.css`). SqlWidgets is visibly behind the rest of the app:
raw `<table>`, a drawer with no backdrop/close button/animation,
unstyled by comparison to `WidgetPalette` and `ConfirmDialog`, which
already establish the app's drawer/dialog convention.

## 1. Shared `PageHeader` component

New `web/src/ui/PageHeader.tsx`:

```
<PageHeader
  eyebrow="overview · all properties"
  title="Overview"
  meta={<span>...optional mono meta line/slug/status...</span>}
  stats={[{ k: "Apps", v: 4 }, ...]}   // optional compact stat cluster
  actions={<>...toolbar buttons...</>}  // optional right-aligned
/>
```

Renders: eyebrow line (unchanged `.eyebrow` class) → plain title as
`h2`-scale text, `font-display`, weight 500, **no italic accent span,
no hero-length copy** — just the page/entity name → optional single
mono meta line under the title → `actions`/`stats` right-aligned on
the same row as the title, vertically centered. Replaces the current
ad hoc `<header style={{...}}>` blocks in each page.

Used by Overview, AppPage, Settings, SqlWidgets. Analytics keeps its
own `.an__header` (hamburger + db-select + context toggle + Clear
don't fit the generic slot cleanly) but switches its title copy to
match PageHeader's plain-title convention (no "Ask anything." hero,
just "Analytics") for chrome consistency, and reuses `.eyebrow` as-is.

Per-page mapping:
- **Overview**: eyebrow `overview · all properties`, title `Overview`,
  `stats` = the existing Apps/Online/Healthy cluster, `actions` = the
  existing toolbar (SaveBadge, range buttons, Add widget).
- **AppPage**: eyebrow `property`, title = app label (plain, no
  italic/color), `meta` = existing `slug: … · pm2: … · health: …`
  line, `actions` = existing toolbar.
- **Settings**: eyebrow `settings · workspace`, title `Access &
  invites`. The current descriptive paragraph stays as regular body
  text below the header (not part of the header itself).
- **SqlWidgets**: eyebrow `admin · sql widgets`, title `Custom SQL
  widgets`, `actions` = `+ New widget` button.

No grid/widget internals, Shell, or Sidebar change.

## 2. Shared row-list style for tabular data

New CSS in `theme.css`: `.row-list` (container) / `.row-item` (row) —
generalizes the row treatment Settings already uses for invites
(`bg-elev` background, `var(--rule)` border, `var(--radius)`, flex
layout, hover state) so SqlWidgets' widget list uses the identical
pattern instead of a raw `<table>`. Settings' invite list switches to
the same shared classes (dedupes the inline styles, same visual
result).

SqlWidgets list row shows: name + description (truncated) stacked on
the left, a small mono pill for `viz`, `data_source`, and `updated_at`
in the middle, Edit/Delete actions on the right — same information as
today's table columns, just row-card layout instead of `<table>`.
Empty state and loading skeleton unchanged in behavior.

## 3. SqlWidgets editor drawer

Bring the editor drawer in line with `WidgetPalette`'s established
drawer convention: fixed backdrop (click to close, matching
`ConfirmDialog`/`WidgetPalette`), `fadeUp` entry animation, header row
with `eyebrow` + `h3` + a close `X` icon button (currently the drawer
has no backdrop and no explicit close affordance besides "Cancel").
Internals (name/description/data source/schema tree/CodeMirror/
preview/viz options) unchanged — same fields, same labels, same
order, so `SqlWidgets.test.tsx` selectors (`getByLabelText`,
`getByRole("button", {name: ...})`) keep working untouched.

## 4. Density

Scoped strictly to the new `PageHeader` and row-list — tighten the
28px header gaps down to match the rest of the app's panel rhythm (16
-20px), and row-list items get the same compact padding as Settings'
current invite rows (10-12px). No change to global `.panel` padding
or widget-grid spacing — those are shared by every widget on every
page and out of scope for a page-chrome redesign.

## Out of scope

Shell/Sidebar chrome, GridCanvas/widget rendering, Analytics rail/
composer/result-pane internals, theme tokens/palette, any API or data
shape.

## Testing

Existing test suites (`SqlWidgets.test.tsx`, others) must keep passing
unmodified — redesign changes markup/styling, not labels, roles, or
button text used as selectors. No new tests required (pure
presentation); run `npm run test -w web` after.

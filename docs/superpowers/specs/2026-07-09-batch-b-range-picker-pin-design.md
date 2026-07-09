# Batch B: global time-range picker + pin-to-dashboard

Approved 2026-07-09. Builds on batch A param plumbing.

## 1. Global time-range picker

Segmented 7d/30d/90d control in the layout toolbar (next to SaveBadge /
"+ Add widget") on Overview and app pages.

**Semantics — global default, widget pin wins.** A widget with no explicit
`range` in its params follows the page picker. A widget whose range was set
via its gear popover keeps that range. The popover's range select gains a
"page default" empty option to unpin.

**Mechanics:**
- `useLayoutPage` owns `pageRange` state, persisted to
  `localStorage["range:<screen>"]`, default `30d`.
- `renderWidget` passes merged params to the component:
  `{ ...w.params, range: w.params.range ?? pageRange }`. Components and
  server untouched; query keys already include params so refetch is free.
- Saved layout JSON never contains the page range (localStorage only,
  per-user like layouts themselves).
- Widgets whose range enum lacks the picked value (e.g. 90d on a 7d/30d
  widget) send it anyway; server range parsing falls back to 30d.

**Tests:** merge helper (explicit param wins, page range fills gap);
popover range select offers and round-trips the empty "page default" value.

## 2. Pin to dashboard (Ask DB → SQL widget)

New action in Ask DB `ResultActions`, admin-only (`useMe().is_admin`),
enabled when the answer has SQL: "add to dashboard".

Opens a small form (same pattern as the existing ★ pin form):
- **name** — prefilled from the question
- **data source** — select from `/api/sql-widgets/sources`, preselected when
  the conversation's `db` matches a source name

On submit:
1. `POST /api/sql-widgets/preview` with the SQL + chosen source — validates
   read-only execution and returns `inferred_viz`.
2. `POST /api/sql-widgets` with name, description = question, sql, viz from
   the preview.
3. Toast success: widget now available in every dashboard palette.

No server changes: both endpoints exist; batch-A param fix already lets
SQL without `:range_days` run.

**Tests:** action hidden for non-admin and when no SQL; happy path posts
preview then create with inferred viz (mocked api layer).

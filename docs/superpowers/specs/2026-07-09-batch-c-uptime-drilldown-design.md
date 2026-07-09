# Batch C: uptime history strip + widget drill-down

Approved 2026-07-09.

## 1. Uptime widget

Poller already writes `health_ok` (1/0) to `metric_samples` every 30s per
app; the widget is a pure read.

**Server:** new `uptime` kind in the metrics route. Buckets the range into
48 slices via `width_bucket`, returns `{ buckets: [{ bucket, ratio,
samples }] }` where `ratio` is the mean of `health_ok` in the slice and
`samples` its row count. Range: `24h`, `7d` (default), `30d`; unknown values
(e.g. `90d` from the page picker) fall back to 7d.

**Web:** `UptimeStrip` widget — horizontal strip of 48 segments: green
(ratio ≥ .995), amber (partial), red (≤ .5), neutral when no samples.
Header meta shows overall uptime % (sample-weighted). Registered in
`widgets.json` as app-scoped, 6×2, `range` enum param.

**Tests:** route test seeds `metric_samples` and asserts bucket shape and
fallback; web unit tests for `bucketColor` / `overallUptime` helpers.

## 2. Drill-down modal

Expand button (maximize icon) in `WidgetFrame`, wired like param editing:
`ExpandContext` provided per grid item by `useLayoutPage`, so widget
components stay untouched. Clicking opens a near-fullscreen modal
(90vw × 80vh) rendering the same widget component with the same params,
plus its own 7d/30d/90d range switcher (local state, does not touch the
saved layout). SQL widgets additionally show their SQL in a collapsible
block. Escape / backdrop / close button dismiss. Inside the modal no
editing or expand affordances are provided (no contexts).

**Tests:** WidgetFrame shows expand only with context; modal renders and
closes; range switch re-renders with the chosen range.

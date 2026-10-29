import { readNew, summarize } from "../collectors/nginx.js";

const WINDOW_MS = 60 * 60_000;
const REFRESH_MS = 5_000;

// Per-app rolling hour of parsed access-log entries. Each refresh reads only
// the bytes appended since the last one.
const state = new Map();

export function _resetTrafficForTests() {
  state.clear();
}

export async function trafficWindow(appCfg) {
  const slug = appCfg.slug;
  let s = state.get(slug);
  if (!s) {
    s = { offset: null, entries: [], until: 0, error: null };
    state.set(slug, s);
  }
  if (s.until > Date.now()) return s;

  const r = await readNew(appCfg.nginx_log, { fromOffset: s.offset });
  s.until = Date.now() + REFRESH_MS;
  if (r.error) {
    s.error = r.error;
    s.offset = null;
    s.entries = [];
    return s;
  }
  const cutoff = Date.now() - WINDOW_MS;
  s.entries = s.entries.concat(r.entries).filter((e) => e.ts >= cutoff);
  s.offset = r.nextOffset;
  // Lines are arriving but none parse: the vhost isn't using our log format.
  s.error = r.unmatched > 0 && r.entries.length === 0 && s.entries.length === 0
    ? "log_format_unrecognized"
    : null;
  return s;
}

export async function traffic(appCfg) {
  const s = await trafficWindow(appCfg);
  if (s.error) throw new Error(s.error);
  const now = Date.now();
  const last5 = summarize(s.entries, 5 * 60_000, now);
  const lastHour = summarize(s.entries, WINDOW_MS, now);
  return {
    per_min: Math.round((last5.count / 5) * 10) / 10,
    last_5m: last5,
    last_hour: lastHour,
    p95_ms_15m: summarize(s.entries, 15 * 60_000, now).p95_ms,
    // Requests per 5-minute slot over the last hour, oldest first.
    buckets: Array.from({ length: 12 }, (_, i) => {
      const to = now - (11 - i) * 5 * 60_000;
      return s.entries.filter((e) => e.ts > to - 5 * 60_000 && e.ts <= to).length;
    }),
  };
}

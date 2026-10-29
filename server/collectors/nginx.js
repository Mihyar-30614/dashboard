import fs from "node:fs";

// combined log format + " $request_time" (see config/nginx/observatory-log.conf).
const LINE =
  /\[(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})\]\s"\S+\s\S+\s\S+"\s(\d{3})\s\d+\s"[^"]*"\s"[^"]*"\s([\d.]+)\s*$/;
const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

function parseTime(d, mon, y, h, mi, s, tz) {
  const sign = tz[0] === "-" ? -1 : 1;
  const offsetMin = sign * (Number(tz.slice(1, 3)) * 60 + Number(tz.slice(3, 5)));
  return Date.UTC(Number(y), MONTHS[mon], Number(d), Number(h), Number(mi), Number(s)) - offsetMin * 60_000;
}

export function parseLine(line) {
  const m = LINE.exec(line);
  if (!m) return null;
  return {
    ts: parseTime(m[1], m[2], m[3], m[4], m[5], m[6], m[7]),
    status: Number(m[8]),
    ms: Number(m[9]) * 1000,
  };
}

/**
 * Parse the lines appended since `fromOffset`. When there is no offset yet,
 * start `backfillBytes` before the end so a fresh process can fill its window.
 */
export async function readNew(filepath, { fromOffset = null, backfillBytes = 4_000_000 } = {}) {
  let stat;
  try {
    stat = await fs.promises.stat(filepath);
  } catch {
    return { entries: [], unmatched: 0, nextOffset: null, error: "log_unreadable" };
  }

  let start = fromOffset ?? Math.max(0, stat.size - backfillBytes);
  // Rotated or truncated underneath us.
  if (start > stat.size) start = 0;
  const skipFirst = fromOffset == null && start > 0;

  const entries = [];
  let unmatched = 0;
  let nextOffset = start;
  let first = true;

  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filepath, { start, encoding: "utf8" });
    let buf = "";
    stream.on("data", (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        nextOffset += Buffer.byteLength(line, "utf8") + 1;
        // A backfill starts mid-line; drop the fragment.
        if (first && skipFirst) {
          first = false;
          continue;
        }
        first = false;
        const e = parseLine(line);
        if (e) entries.push(e);
        else if (line.trim()) unmatched++;
      }
    });
    stream.on("end", resolve);
    stream.on("error", reject);
  });

  return { entries, unmatched, nextOffset };
}

function pct(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

/** Summarise entries that fall inside the last `windowMs`. */
export function summarize(entries, windowMs, now = Date.now()) {
  const from = now - windowMs;
  let count = 0,
    errors_4xx = 0,
    errors_5xx = 0;
  const latencies = [];
  for (const e of entries) {
    if (e.ts < from) continue;
    count++;
    if (e.status >= 500) errors_5xx++;
    else if (e.status >= 400) errors_4xx++;
    latencies.push(e.ms);
  }
  return { count, errors_4xx, errors_5xx, p95_ms: Math.round(pct(latencies, 0.95)) };
}

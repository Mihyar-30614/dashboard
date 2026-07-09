import { query } from "./db.js";
import * as mailer from "./mailer.js";

export const FAIL_THRESHOLD = 3;

// consecutive failed health ticks per app, reset by any healthy tick
const failStreaks = new Map();
// app_slug -> 'up' | 'down', lazily loaded from alert_state
const statusCache = new Map();

export function _resetForTests() {
  failStreaks.clear();
  statusCache.clear();
}

// Returns 'down' | 'up' | null (no transition).
export function computeTransition(status, ok, failCount, threshold) {
  if (status !== "down" && !ok && failCount >= threshold) return "down";
  if (status === "down" && ok) return "up";
  return null;
}

async function loadStatus(slug) {
  if (statusCache.has(slug)) return statusCache.get(slug);
  const { rows } = await query(
    `SELECT status FROM alert_state WHERE app_slug=$1`,
    [slug],
  );
  const status = rows[0]?.status ?? "up";
  statusCache.set(slug, status);
  return status;
}

async function saveStatus(slug, status) {
  statusCache.set(slug, status);
  await query(
    `INSERT INTO alert_state(app_slug, status, changed_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (app_slug) DO UPDATE SET status=$2, changed_at=NOW()`,
    [slug, status],
  );
}

export async function handleHealthSample(slug, ok) {
  const streak = ok ? 0 : (failStreaks.get(slug) ?? 0) + 1;
  failStreaks.set(slug, streak);

  const status = await loadStatus(slug);
  const transition = computeTransition(status, ok, streak, FAIL_THRESHOLD);
  if (!transition) return;

  await saveStatus(slug, transition);
  const subject =
    transition === "down"
      ? `[dashboard] ${slug} is DOWN`
      : `[dashboard] ${slug} is back up`;
  const text =
    transition === "down"
      ? `Health checks for ${slug} failed ${FAIL_THRESHOLD} times in a row (~${(FAIL_THRESHOLD * 30) / 60} min). Last check just failed.`
      : `Health check for ${slug} succeeded again; it was previously alerting as down.`;
  try {
    await mailer.sendAlertEmail(subject, text);
  } catch (e) {
    console.error("alert_email_failed", slug, e.message);
  }
}

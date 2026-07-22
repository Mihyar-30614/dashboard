import { query } from "./db.js";
import * as mailer from "./mailer.js";
import { buildAlertEmail } from "./emailTemplates.js";

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
  if (statusCache.has(slug)) return statusCache.get(slug).status;
  const { rows } = await query(
    `SELECT status, changed_at FROM alert_state WHERE app_slug=$1`,
    [slug],
  );
  const entry = { status: rows[0]?.status ?? "up", changedAt: rows[0]?.changed_at ?? null };
  statusCache.set(slug, entry);
  return entry.status;
}

function loadChangedAt(slug) {
  return statusCache.get(slug)?.changedAt ?? null;
}

async function saveStatus(slug, status, changedAt) {
  statusCache.set(slug, { status, changedAt });
  await query(
    `INSERT INTO alert_state(app_slug, status, changed_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (app_slug) DO UPDATE SET status=$2, changed_at=$3`,
    [slug, status, changedAt],
  );
}

// app: { slug, label, health_url }
export async function handleHealthSample(app, ok) {
  const slug = app.slug;
  const streak = ok ? 0 : (failStreaks.get(slug) ?? 0) + 1;
  failStreaks.set(slug, streak);

  const status = await loadStatus(slug);
  const transition = computeTransition(status, ok, streak, FAIL_THRESHOLD);
  if (!transition) return;

  const downSince = transition === "up" ? loadChangedAt(slug) : null;
  const now = new Date();
  await saveStatus(slug, transition, now);

  const { subject, text, html } = buildAlertEmail({
    transition,
    label: app.label,
    slug,
    healthUrl: app.health_url,
    failCount: streak,
    threshold: FAIL_THRESHOLD,
    downSince,
    now,
    dashboardUrl: process.env.DASHBOARD_URL || null,
  });

  try {
    await mailer.sendAlertEmail(subject, text, html);
  } catch (e) {
    console.error("alert_email_failed", slug, e.message);
  }
}

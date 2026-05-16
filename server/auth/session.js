import crypto from 'node:crypto';
import { dbPool } from '../db.js';

const SLIDING_THRESHOLD_DAYS = 7;

const cache = new Map();
const CACHE_MS = 60_000;

function ttlDays() {
  return Number(process.env.SESSION_TTL_DAYS || 30);
}

export async function createSession(userId, userAgent, daysOverride) {
  const id = crypto.randomUUID();
  const days = daysOverride ?? ttlDays();
  const { rows } = await dbPool.query(
    `INSERT INTO sessions(id,user_id,expires_at,user_agent)
     VALUES ($1,$2,NOW() + ($3 || ' days')::interval,$4)
     RETURNING id, expires_at`,
    [id, userId, days, userAgent || null]
  );
  return rows[0];
}

export async function loadSession(id) {
  if (!id) return null;
  const hit = cache.get(id);
  if (hit && hit.until > Date.now()) return hit.row;

  const { rows } = await dbPool.query(
    `SELECT s.id, s.user_id, s.created_at, s.expires_at, u.email, u.is_admin
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = $1
        AND s.expires_at > NOW()
        AND u.is_active`,
    [id]
  );
  const row = rows[0] || null;
  if (row) cache.set(id, { row, until: Date.now() + CACHE_MS });
  return row;
}

export async function rotateIfStale(id) {
  const row = await loadSession(id);
  if (!row) return null;
  const ageMs = Date.now() - new Date(row.created_at).getTime();
  if (ageMs < SLIDING_THRESHOLD_DAYS * 86_400_000) return { id };
  await destroySession(id);
  return createSession(row.user_id, null);
}

export async function destroySession(id) {
  cache.delete(id);
  await dbPool.query('DELETE FROM sessions WHERE id=$1', [id]);
}

export function sessionMiddleware() {
  return async (req, res, next) => {
    const name = process.env.SESSION_COOKIE_NAME || 'ds';
    const id = req.cookies?.[name];
    const session = await loadSession(id);
    if (session) req.user = { id: session.user_id, email: session.email, is_admin: session.is_admin };
    req.sessionId = session?.id || null;
    next();
  };
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'forbidden' });
  next();
}

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { dbPool } from '../db.js';
import { verifyPassword, needsRehash, hashPassword } from './password.js';
import { createSession, destroySession, requireAuth } from './session.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false
});

const cookieName = () => process.env.SESSION_COOKIE_NAME || 'ds';
const ttlMs = () => Number(process.env.SESSION_TTL_DAYS || 30) * 86_400_000;

export function setSessionCookie(res, id) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(cookieName(), id, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: ttlMs()
  });
}

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });

  const { rows } = await dbPool.query(
    `SELECT id, password_hash, is_active FROM users WHERE email=$1`,
    [String(email).toLowerCase()]
  );
  const user = rows[0];
  if (!user || !user.is_active || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: 'invalid' });
  }

  if (needsRehash(user.password_hash)) {
    const newHash = await hashPassword(password);
    await dbPool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [newHash, user.id]);
  }
  await dbPool.query('UPDATE users SET last_login_at=NOW() WHERE id=$1', [user.id]);

  const session = await createSession(user.id, req.headers['user-agent']);
  setSessionCookie(res, session.id);
  res.json({ ok: true });
});

router.post('/logout', async (req, res) => {
  if (req.sessionId) await destroySession(req.sessionId);
  res.clearCookie(cookieName(), { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, is_admin: req.user.is_admin });
});

export default router;

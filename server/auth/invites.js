import crypto from 'node:crypto';
import { Router } from 'express';
import { dbPool } from '../db.js';
import { requireAuth, requireAdmin } from './session.js';

const router = Router();
const TTL_DAYS = 7;

router.use(requireAuth);

router.post('/', requireAdmin, async (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  const { rows } = await dbPool.query(
    `INSERT INTO invites(token,email,created_by,expires_at)
     VALUES ($1,$2,$3, NOW() + INTERVAL '${TTL_DAYS} days')
     RETURNING id, token, email, expires_at`,
    [token, req.body?.email || null, req.user.id]
  );
  res.json(rows[0]);
});

router.get('/', requireAdmin, async (_req, res) => {
  const { rows } = await dbPool.query(
    `SELECT id, email, created_at, expires_at, used_at
       FROM invites
      WHERE used_at IS NULL AND expires_at > NOW()
      ORDER BY created_at DESC`
  );
  res.json(rows);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  await dbPool.query(
    `UPDATE invites SET used_at=NOW() WHERE id=$1 AND used_at IS NULL`,
    [req.params.id]
  );
  res.json({ ok: true });
});

export default router;

export async function consumeInviteToken(token) {
  const { rows } = await dbPool.query(
    `SELECT id FROM invites
      WHERE token=$1 AND used_at IS NULL AND expires_at > NOW()`,
    [token]
  );
  if (!rows[0]) throw new Error('invalid_token');
  return rows[0].id;
}

import { describe, it, expect } from 'vitest';
import { createSession, loadSession, destroySession } from './session.js';
import { dbPool } from '../db.js';

async function makeUser() {
  const { rows } = await dbPool.query(
    `INSERT INTO users(email,password_hash,is_active,is_admin)
     VALUES($1,$2,true,true) RETURNING id`,
    ['admin@example.com', 'hash']
  );
  return rows[0].id;
}

describe('session', () => {
  it('creates and loads a session', async () => {
    const userId = await makeUser();
    const s = await createSession(userId, 'agent-x');
    expect(s.id).toMatch(/^[0-9a-f-]{36}$/);

    const loaded = await loadSession(s.id);
    expect(loaded.user_id).toBe(String(userId));
    expect(loaded.email).toBe('admin@example.com');
  });

  it('rejects expired sessions', async () => {
    const userId = await makeUser();
    const s = await createSession(userId, 'a', -1);
    expect(await loadSession(s.id)).toBeNull();
  });

  it('destroys sessions', async () => {
    const userId = await makeUser();
    const s = await createSession(userId, 'a');
    await destroySession(s.id);
    expect(await loadSession(s.id)).toBeNull();
  });
});

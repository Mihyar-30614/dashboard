import { describe, it, expect } from 'vitest';
import { seedAdmin } from './seed.js';
import { dbPool } from '../db.js';

describe('seedAdmin', () => {
  it('creates the first admin', async () => {
    await seedAdmin('admin@example.com', 'zX9!muPpetDance#Lurking');
    const { rows } = await dbPool.query('SELECT email, is_admin FROM users');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ email: 'admin@example.com', is_admin: true });
  });

  it('replaces any existing users with the new admin', async () => {
    await seedAdmin('a@example.com', 'zX9!muPpetDance#Lurking');
    await seedAdmin('b@example.com', 'qP4#bRotherSailing!Moon');
    const { rows } = await dbPool.query('SELECT email, is_admin FROM users');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ email: 'b@example.com', is_admin: true });
  });

  it('rejects weak passwords', async () => {
    await expect(seedAdmin('a@example.com', 'short')).rejects.toThrow('min_length');
  });

  it('does not wipe users when password is rejected', async () => {
    await seedAdmin('a@example.com', 'zX9!muPpetDance#Lurking');
    await expect(seedAdmin('b@example.com', 'short')).rejects.toThrow('min_length');
    const { rows } = await dbPool.query('SELECT email FROM users');
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe('a@example.com');
  });
});

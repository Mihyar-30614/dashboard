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

  it('refuses if users already exist', async () => {
    await seedAdmin('a@example.com', 'zX9!muPpetDance#Lurking');
    await expect(
      seedAdmin('b@example.com', 'zX9!muPpetDance#Lurking')
    ).rejects.toThrow('users_exist');
  });

  it('rejects weak passwords', async () => {
    await expect(seedAdmin('a@example.com', 'short')).rejects.toThrow('min_length');
  });
});

import { dbPool } from '../db.js';
import { hashPassword, validatePolicy } from './password.js';

export async function seedAdmin(email, password) {
  const policy = validatePolicy(password);
  if (!policy.ok) throw new Error(policy.reason);

  const hash = await hashPassword(password);
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM users');
    await client.query(
      `INSERT INTO users(email,password_hash,is_admin,is_active)
       VALUES($1,$2,true,true)`,
      [email.toLowerCase(), hash]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

import { dbPool } from '../db.js';
import { hashPassword, validatePolicy } from './password.js';

export async function seedAdmin(email, password) {
  const policy = validatePolicy(password);
  if (!policy.ok) throw new Error(policy.reason);

  const { rows: existing } = await dbPool.query('SELECT 1 FROM users LIMIT 1');
  if (existing.length) throw new Error('users_exist');

  const hash = await hashPassword(password);
  await dbPool.query(
    `INSERT INTO users(email,password_hash,is_admin,is_active)
     VALUES($1,$2,true,true)`,
    [email.toLowerCase(), hash]
  );
}

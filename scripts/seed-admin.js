import 'dotenv/config';
import { seedAdmin } from '../server/auth/seed.js';
import { dbPool } from '../server/db.js';

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) {
  console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
  process.exit(1);
}

seedAdmin(email, password)
  .then(() => { console.log('seeded admin'); return dbPool.end(); })
  .catch(err => { console.error(err.message); process.exit(2); });

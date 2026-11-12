const path = require('node:path');
const root = path.resolve(__dirname, '..');
require(require.resolve('dotenv', { paths: [path.join(root, 'server')] })).config({ path: path.join(root, '.env'), quiet: true });
const { backupDatabase } = require('./backup.cjs');
backupDatabase({ directory: process.argv[2] || path.join(root, 'backups/database'), prefix: 'dashboard', env: { DB_USER: 'dashboard', ...process.env } })
  .then(file => console.log(`Backup created: ${file}`))
  .catch(() => { console.error('Database backup or retention failed; check PostgreSQL access, client version and directory permissions.'); process.exitCode = 1; });

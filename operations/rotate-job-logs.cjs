const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const directory = process.env.JOBS_STATE_DIR || path.join(__dirname, '.state');
const logs = path.join(directory, 'logs');
fs.mkdirSync(logs, { recursive: true, mode: 0o700 });
const config = path.join(directory, 'job-logrotate.conf');
fs.writeFileSync(config, `"${logs}/*.log" {
 daily
 rotate 14
 maxage 30
 maxsize 5M
 missingok
 notifempty
 compress
 delaycompress
 copytruncate
}
`, { mode: 0o600 });
const result = spawnSync('/usr/sbin/logrotate', ['--state', path.join(directory, 'job-logrotate.state'), config], { stdio: 'inherit' });
process.exitCode = result.error ? 1 : (result.status ?? 1);

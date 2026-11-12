const { spawnSync } = require('node:child_process');
const path = require('node:path');
const result = spawnSync(process.execPath, [path.join(__dirname, 'cli.cjs'), 'check'], { stdio: 'inherit' });
let code = result.error ? 1 : (result.status ?? 1);
process.exitCode = code;

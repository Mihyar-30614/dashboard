#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');
const { writeState } = require('./jobs.cjs');
const root = path.resolve(__dirname, '..');
const config = require('./schedule.json');
const stateDir = process.env.JOBS_STATE_DIR || path.join(__dirname, '.state');
const quote = value => "'" + String(value).replace(/'/g, "'\\''") + "'";
const commandArgs = job => job.command.map(value => value === '$NODE' ? process.execPath : value);
function cronBlock() {
  return [`# BEGIN managed-jobs:${config.app}`, '# Clock: server local time (America/Halifax on this host). Application cron uses UTC.',
    ...config.hostJobs.map(job => `${job.schedule} ${quote(process.execPath)} ${quote(__filename)} run ${quote(job.name)} >> ${quote(path.join(root, config.logDirectory, `${job.name}.log`))} 2>&1`),
    `# END managed-jobs:${config.app}`].join('\n');
}
function mergeCrontab(current) {
  const begin = `# BEGIN managed-jobs:${config.app}`, end = `# END managed-jobs:${config.app}`;
  let inside = false;
  const kept = [];
  for (const line of current.split('\n')) {
    if (line === begin) { if (inside) throw new Error('Malformed managed block'); inside = true; continue; }
    if (line === end) { if (!inside) throw new Error('Malformed managed block'); inside = false; continue; }
    if (inside) continue;
    // Migrate only exact legacy command lines copied from the verified host snapshot.
    if (config.legacyLines.includes(line)) continue;
    if (!line.trimStart().startsWith('#') && line.includes(`${root}/`) &&
      config.legacyCommands.some(command => line.includes(command))) {
      throw new Error('Unrecognized existing app job; review it before installation to prevent duplicates');
    }
    kept.push(line);
  }
  if (inside) throw new Error('Unclosed managed cron block');
  return kept.join('\n').trimEnd() + '\n' + cronBlock() + '\n';
}
async function execute(job) {
  const args = commandArgs(job);
  let previous = {};
  try { previous = JSON.parse(fs.readFileSync(path.join(stateDir, `${job.name}.json`))); } catch {}
  const state = { ...previous, lastStartedAt: new Date().toISOString(), pid: process.pid };
  writeState(job.name, state, stateDir);
  const code = await new Promise(resolve => {
    const child = spawn(args[0], args.slice(1), { cwd: path.join(root, job.cwd || '.'),
      env: { ...process.env, NODE_ENV: 'production', ...(job.env || {}) }, stdio: 'inherit', detached: true });
    const terminate = signal => { if (child.pid) { try { process.kill(-child.pid, signal); } catch {} } };
    const timeout = setTimeout(() => terminate('SIGTERM'), job.timeoutMs || 3600000);
    let killTimer;
    child.once('spawn', () => { killTimer = setTimeout(() => terminate('SIGKILL'), (job.timeoutMs || 3600000) + 10000); });
    child.once('error', () => { clearTimeout(timeout); clearTimeout(killTimer); resolve(1); });
    child.once('close', result => { clearTimeout(timeout); clearTimeout(killTimer); resolve(result ?? 1); });
  });
  state.failed = code !== 0;
  state[code === 0 ? 'lastSucceededAt' : 'lastFailedAt'] = new Date().toISOString();
  writeState(job.name, state, stateDir);
  return code;
}
function inspectJobs(jobs, directory = stateDir, now = Date.now()) {
  const issues = [];
  for (const job of jobs) {
    if (job.disabledEnv && process.env[job.disabledEnv] === 'off') continue;
    let state;
    try { state = JSON.parse(fs.readFileSync(path.join(directory, `${job.name}.json`))); }
    catch { issues.push(`${job.name}: no readable job status`); continue; }
    const lastSuccess = Date.parse(state.lastSucceededAt);
    // Registration grants one period only while this registered API process lives.
    let alive = false;
    try { process.kill(state.pid, 0); alive = true; } catch (error) { alive = error.code === 'EPERM'; }
    const reference = Number.isFinite(lastSuccess) ? lastSuccess : alive ? Date.parse(state.registeredAt) : NaN;
    if (!Number.isFinite(reference) || now - reference > job.maxAgeMs) issues.push(`${job.name}: overdue`);
    if (state.failed) issues.push(`${job.name}: last run failed`);
  }
  return issues;
}
function check() {
  const issues = inspectJobs([...config.applicationJobs, ...config.hostJobs.filter(job => job.name !== 'operations-check')]);
  console.log(JSON.stringify({ app: config.app, status: issues.length ? 'error' : 'ok', issues }));
  return issues.length ? 1 : 0;
}
async function main([action, name]) {
  if (action === 'cron') { console.log(cronBlock()); return 0; }
  if (action === 'check') {
    // Dashboard allows opting out of the poller in its regular .env.
    if (config.envFile) {
      const dotenv = require(require.resolve('dotenv', { paths: [path.join(root, config.dependencyDirectory)] }));
      dotenv.config({ path: path.join(root, config.envFile), quiet: true });
    }
    return check();
  }
  if (action === 'install') {
    const result = spawnSync('/usr/bin/flock', ['-w', '15', path.join(path.dirname(root), '.scheduled-work-install.lock'), process.execPath, __filename, '_install'], { stdio: 'inherit' });
    return result.error ? 1 : (result.status ?? 1);
  }
  if (action === '_install') {
    const old = spawnSync('crontab', ['-l'], { encoding: 'utf8' });
    if (old.error || (old.status !== 0 && !/^no crontab for [^\n]+\s*$/.test(old.stderr || ''))) {
      throw new Error('Cannot read live crontab; installation stopped without changes');
    }
    const proposed = mergeCrontab(old.stdout || '');
    fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    fs.mkdirSync(path.join(root, config.logDirectory), { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(stateDir, `crontab-before-${Date.now()}.txt`), old.stdout || '', { mode: 0o600 });
    const result = spawnSync('crontab', ['-'], { input: proposed, encoding: 'utf8' });
    if (result.error || result.status !== 0) throw new Error('Crontab installation failed');
    console.log(`Installed ${config.app} jobs; previous crontab saved privately.`);
    return 0;
  }
  const job = config.hostJobs.find(entry => entry.name === name);
  if (!job || !['run', '_execute'].includes(action)) throw new Error('Usage: node operations/cli.cjs cron|install|check|run <job>');
  if (action === '_execute') return execute(job);
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const result = spawnSync('/usr/bin/flock', ['-n', '-E', '75', path.join(stateDir, `${name}.lock`), process.execPath, __filename, '_execute', name], { stdio: 'inherit' });
  if (!result.error && result.status === 75) { console.log(`${name}: previous run still active; skipped`); return 0; }
  if (result.error) console.error('Cannot execute scheduled job lock; verify host process permissions.');
  return result.error ? 1 : (result.status ?? 1);
}
module.exports = { mergeCrontab, cronBlock, check, inspectJobs, execute };
if (require.main === module) main(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(error => { console.error(error.message); process.exitCode = 1; });

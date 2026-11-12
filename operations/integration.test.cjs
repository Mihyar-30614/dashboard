const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('Dashboard poller preserves cadence, prevents overlap and cancels retention on shutdown', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-jobs-'));
  const previousState = process.env.JOBS_STATE_DIR;
  process.env.JOBS_STATE_DIR = path.join(directory, 'state');
  t.after(() => {
    if (previousState === undefined) delete process.env.JOBS_STATE_DIR;
    else process.env.JOBS_STATE_DIR = previousState;
    fs.rmSync(directory, { recursive: true, force: true });
  });
  // Run the real poller and runtime with only its external collectors/database replaced.
  for (const name of ['server/collectors', 'operations']) fs.mkdirSync(path.join(directory, name), { recursive: true });
  fs.writeFileSync(path.join(directory, 'package.json'), '{"type":"module"}');
  fs.copyFileSync(path.resolve(__dirname, '../server/poller.js'), path.join(directory, 'server/poller.js'));
  fs.copyFileSync(path.join(__dirname, 'jobs.cjs'), path.join(directory, 'operations/jobs.cjs'));
  fs.writeFileSync(path.join(directory, 'server/db.js'), 'export const calls=[]; export async function query(sql) { calls.push(sql); return {}; }');
  fs.writeFileSync(path.join(directory, 'server/config.js'), 'export const loadApps=()=>({one:{slug:"one",health_url:"fixture"}});');
  fs.writeFileSync(path.join(directory, 'server/alerts.js'), 'export async function handleHealthSample() {}');
  fs.writeFileSync(path.join(directory, 'server/collectors/pm2.js'), 'export async function snapshot() { return {}; }');
  fs.writeFileSync(path.join(directory, 'server/collectors/health.js'), 'export async function checkHealth() { return {ok:true}; }');
  const poller = await import(pathToFileURL(path.join(directory, 'server/poller.js')).href);
  const { calls } = await import(pathToFileURL(path.join(directory, 'server/db.js')).href);
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  poller.startPoller();
  await new Promise(setImmediate);
  assert.equal(calls.length, 1);
  t.mock.timers.tick(30000);
  await new Promise(setImmediate);
  assert.equal(calls.length, 2);
  t.mock.timers.tick(270000);
  await new Promise(setImmediate);
  assert.equal(calls.filter(sql => sql.startsWith('DELETE')).length, 1);
  await poller.stopPoller();
  const before = calls.length;
  t.mock.timers.tick(2 * 86400000);
  await new Promise(setImmediate);
  assert.equal(calls.length, before);
  const status = JSON.parse(fs.readFileSync(path.join(directory, 'state/poller.json')));
  assert.equal(status.failed, false);
});

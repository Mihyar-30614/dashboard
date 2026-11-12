const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { gunzipSync } = require('node:zlib');
const { trackedJob, intervalJob } = require('./jobs.cjs');
const { mergeCrontab, inspectJobs } = require('./cli.cjs');
const config = require('./schedule.json');
const subprocessAvailable = !spawnSync(process.execPath, ['-e', ''], { encoding: 'utf8' }).error;
const childEnv = { ...process.env };
delete childEnv.NODE_TEST_CONTEXT;
function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'scheduled-work-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('overlapping evaluations share work; shutdown waits and prevents subsequent work', async t => {
  const directory = temporary(t);
  let release, calls = 0;
  const job = trackedJob('fixture', () => { calls++; return new Promise(resolve => { release = resolve; }); }, { directory });
  const first = job.run();
  assert.equal(job.run(), first);
  await new Promise(setImmediate);
  let stopped = false;
  const stopping = job.stop().then(() => { stopped = true; });
  await new Promise(setImmediate);
  assert.equal(stopped, false);
  release();
  await stopping;
  await job.run();
  assert.equal(calls, 1);
  const state = JSON.parse(fs.readFileSync(path.join(directory, 'fixture.json')));
  assert.equal(state.failed, false);
  assert.ok(state.lastSucceededAt);
  assert.equal(fs.statSync(path.join(directory, 'fixture.json')).mode & 0o777, 0o600);
});

test('failures are recorded without secrets; later success clears failure', async t => {
  const directory = temporary(t), reports = [];
  let fail = true;
  const job = trackedJob('fixture', () => { if (fail) throw new Error('SECRET'); }, { directory, report: text => reports.push(text) });
  await job.run();
  assert.equal(job.state.failed, true);
  assert.ok(job.state.lastFailedAt);
  assert.ok(!JSON.stringify(reports).includes('SECRET'));
  fail = false;
  await job.run();
  assert.equal(job.state.failed, false);
  await job.stop();
});

test('stopping a delayed interval cancels both its initial and recurring work', async t => {
  let calls = 0;
  const job = intervalJob('delayed', 5, () => { calls++; }, { directory: temporary(t), initialDelayMs: 10 });
  await job.stop();
  await new Promise(resolve => setTimeout(resolve, 35));
  assert.equal(calls, 0);
});

test('cron migration preserves other apps and comments, removes only known legacy entries, and is idempotent', () => {
  const unrelated = '*/2 * * * * /mnt/storage/apps/pm2-health-check.sh >/dev/null 2>&1';
  const current = '# operator note\n' + unrelated + '\n' + config.legacyLines.join('\n') + '\n';
  const merged = mergeCrontab(current);
  assert.ok(merged.includes(unrelated));
  assert.ok(merged.includes('# operator note'));
  for (const line of config.legacyLines) assert.ok(!merged.split('\n').includes(line));
  assert.equal(mergeCrontab(merged), merged);
  assert.equal(merged.split(`BEGIN managed-jobs:${config.app}`).length, 2);
  assert.throws(() => mergeCrontab(`# BEGIN managed-jobs:${config.app}\n`), /Unclosed/);
});

test('an unknown existing app backup command aborts migration', () => {
  const root = path.resolve(__dirname, '..');
  assert.throws(() => mergeCrontab(`0 1 * * * cd ${root}/ && node scripts/backup-database.js --custom\n`), /Unrecognized/);
});

test('only Sportly and DebtManager have offsite schedules', () => {
  assert.equal(config.hostJobs.some(job => job.name === 'offsite-backup'), ['sportly', 'debtmanager'].includes(config.app));
});

function fixtureCLI(t, command, exitCode = 0) {
  const root = temporary(t), ops = path.join(root, 'operations'), state = path.join(root, 'state');
  fs.mkdirSync(ops);
  for (const file of ['cli.cjs', 'jobs.cjs']) fs.copyFileSync(path.join(__dirname, file), path.join(ops, file));
  const fixture = path.join(root, 'fixture.cjs');
  fs.writeFileSync(fixture, command || `process.exit(${exitCode});`);
  fs.writeFileSync(path.join(ops, 'schedule.json'), JSON.stringify({ app: 'fixture', logDirectory: 'logs', legacyCommands: [], legacyLines: [],
    applicationJobs: [], hostJobs: [{ name: 'fixture', schedule: '* * * * *', command: ['$NODE', fixture], maxAgeMs: 60000, timeoutMs: 1000 }] }));
  return { root, ops, state, run: args => spawnSync(process.execPath, [path.join(ops, 'cli.cjs'), ...args], { env: { ...childEnv, JOBS_STATE_DIR: state }, encoding: 'utf8' }) };
}

test('host execution records success/failure and health checks fail on missing, stale or failed jobs', { skip: !subprocessAvailable && 'Sandbox blocks Node subprocess execution' }, t => {
  const fixture = fixtureCLI(t);
  assert.equal(fixture.run(['check']).status, 1);
  assert.equal(fixture.run(['run', 'fixture']).status, 0);
  assert.equal(fixture.run(['check']).status, 0);
  const statusFile = path.join(fixture.state, 'fixture.json');
  const status = JSON.parse(fs.readFileSync(statusFile));
  status.lastSucceededAt = new Date(Date.now() - 120000).toISOString();
  fs.writeFileSync(statusFile, JSON.stringify(status));
  assert.equal(fixture.run(['check']).status, 1);
  fs.writeFileSync(path.join(fixture.root, 'fixture.cjs'), 'process.exit(9);');
  assert.equal(fixture.run(['run', 'fixture']).status, 9);
  assert.equal(fixture.run(['check']).status, 1);
  assert.equal(JSON.parse(fs.readFileSync(statusFile)).failed, true);
});

test('job lock prevents another host process from executing the same job', { skip: !subprocessAvailable && 'Sandbox blocks Node subprocess execution' }, t => {
  const fixture = fixtureCLI(t, 'throw new Error("must not execute");');
  fs.mkdirSync(fixture.state);
  const lock = path.join(fixture.state, 'fixture.lock');
  const result = spawnSync('/usr/bin/flock', [lock, process.execPath, path.join(fixture.ops, 'cli.cjs'), 'run', 'fixture'], {
    env: { ...childEnv, JOBS_STATE_DIR: fixture.state }, encoding: 'utf8', timeout: 5000,
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /previous run still active/);
  assert.ok(!fs.existsSync(path.join(fixture.state, 'fixture.json')));
});

if (fs.existsSync(path.join(__dirname, 'backup.cjs'))) {
  const { backupDatabase } = require('./backup.cjs');
  const dump = (code, data) => () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => {};
    process.nextTick(() => { child.stdout.end(data); child.stderr.end(); child.emit('close', code); });
    return child;
  };
  test('backup failure and empty output preserve previous archives; successful output is compressed and private', async t => {
    const directory = temporary(t);
    const old = path.join(directory, 'fixture_backup_previous.sql.gz');
    fs.writeFileSync(old, 'previous');
    for (const [code, data] of [[1, 'partial'], [0, '']]) {
      await assert.rejects(backupDatabase({ directory, prefix: 'fixture', keep: 1, spawnDump: dump(code, data) }));
      assert.deepEqual(fs.readdirSync(directory), [path.basename(old)]);
      assert.equal(fs.readFileSync(old, 'utf8'), 'previous');
    }
    const outside = path.join(directory, 'unrelated.sql'); fs.writeFileSync(outside, 'keep');
    const link = path.join(directory, 'fixture_backup_link.sql.gz'); fs.symlinkSync(outside, link);
    const file = await backupDatabase({ directory, prefix: 'fixture', keep: 1, spawnDump: dump(0, 'SELECT 1;\n') });
    assert.equal(gunzipSync(fs.readFileSync(file)).toString(), 'SELECT 1;\n');
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.ok(!fs.existsSync(old));
    assert.ok(fs.lstatSync(link).isSymbolicLink());
    assert.equal(fs.readFileSync(outside, 'utf8'), 'keep');
    assert.ok(!fs.readdirSync(directory).some(name => name.endsWith('.partial')));
  });
}

test('health checks distinguish missing, overdue, failed and recovering jobs', t => {
  const directory = temporary(t), now = Date.now();
  const jobs = [{ name: 'fixture', maxAgeMs: 1000 }];
  const target = path.join(directory, 'fixture.json');
  assert.deepEqual(inspectJobs(jobs, directory, now), ['fixture: no readable job status']);
  const save = value => fs.writeFileSync(target, JSON.stringify(value));
  save({ registeredAt: new Date(now).toISOString(), pid: process.pid });
  assert.deepEqual(inspectJobs(jobs, directory, now), []);
  assert.deepEqual(inspectJobs(jobs, directory, now + 1001), ['fixture: overdue']);
  save({ registeredAt: new Date(now).toISOString(), pid: 2147483647 });
  assert.deepEqual(inspectJobs(jobs, directory, now), ['fixture: overdue']);
  save({ lastSucceededAt: new Date(now).toISOString(), failed: true });
  assert.deepEqual(inspectJobs(jobs, directory, now), ['fixture: last run failed']);
  save({ lastSucceededAt: new Date(now).toISOString(), failed: false });
  assert.deepEqual(inspectJobs(jobs, directory, now), []);
});

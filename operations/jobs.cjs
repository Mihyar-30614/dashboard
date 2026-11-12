const fs = require('node:fs');
const path = require('node:path');
const stateDirectory = process.env.JOBS_STATE_DIR || path.join(__dirname, '.state', ...(process.env.NODE_ENV === 'production' ? [] : ['development']));

function writeState(name, state, directory = stateDirectory) {
  if (process.env.NODE_ENV === 'test' && !process.env.JOBS_STATE_DIR && directory === stateDirectory) return;
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const target = path.join(directory, `${name}.json`);
  const temporary = `${target}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 });
    fs.renameSync(temporary, target);
  } finally { fs.rmSync(temporary, { force: true }); }
}

// One running evaluation per process. Database/provider idempotency remains the
// responsibility of each job; production APIs run as one PM2 fork instance.
function trackedJob(name, evaluate, { directory = stateDirectory, report = console.error } = {}) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error('Invalid scheduled job name');
  let running = null;
  let stopped = false;
  const state = { registeredAt: new Date().toISOString(), pid: process.pid };
  const persist = () => {
    try { writeState(name, state, directory); }
    catch { report(`Scheduled job status could not be written: ${name}`); }
  };
  persist();
  function run() {
    if (stopped) return Promise.resolve();
    if (running) return running;
    running = Promise.resolve().then(async () => {
      state.lastStartedAt = new Date().toISOString();
      persist();
      try {
        const result = await evaluate();
        state.lastSucceededAt = new Date().toISOString();
        state.failed = false;
        return result;
      } catch {
        state.lastFailedAt = new Date().toISOString();
        state.failed = true;
        report(`Scheduled job failed: ${name}`);
      } finally { persist(); }
    }).finally(() => { running = null; });
    return running;
  }
  return { run, state, async stop() { stopped = true; await running; } };
}

function intervalJob(name, milliseconds, evaluate, { immediate = false, initialDelayMs, unref = true, ...options } = {}) {
  if (!Number.isFinite(milliseconds) || milliseconds < 1) throw new Error('Invalid job interval');
  const job = trackedJob(name, evaluate, options);
  let timer;
  let initial;
  const arm = () => { timer = setInterval(job.run, milliseconds); if (unref) timer.unref(); };
  if (initialDelayMs !== undefined) {
    initial = setTimeout(() => { void job.run(); arm(); }, initialDelayMs);
    if (unref) initial.unref();
  } else { arm(); if (immediate) void job.run(); }
  return { ...job, async stop() { clearTimeout(initial); clearInterval(timer); await job.stop(); } };
}
module.exports = { trackedJob, intervalJob, writeState };

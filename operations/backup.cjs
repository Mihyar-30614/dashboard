const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Transform } = require('node:stream');
const { createGzip } = require('node:zlib');
const { pipeline } = require('node:stream/promises');

async function backupDatabase({ directory, prefix, env = process.env, keep = 14, spawnDump = spawn }) {
  if (!Number.isInteger(keep) || keep < 1 || !/^[a-z]+$/.test(prefix)) throw new Error('Invalid backup policy');
  await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 });
  const filename = `${prefix}_backup_${new Date().toISOString().replace(/[:.]/g, '-')}_${randomUUID()}.sql.gz`;
  const file = path.join(directory, filename);
  const temporary = `${file}.partial`;
  try {
    const child = spawnDump(env.PG_DUMP_BIN || 'pg_dump', ['--no-password', '-h', env.DB_HOST || 'localhost', '-p', String(env.DB_PORT || 5432),
      '-U', env.DB_USER || 'postgres', '-d', env.DB_NAME || prefix, '-F', 'p'], {
      env: { ...env, PGPASSWORD: env.DB_PASSWORD ?? env.PGPASSWORD ?? '' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stderr.resume();
    const exit = new Promise((resolve, reject) => {
      child.once('error', () => reject(new Error('Could not start pg_dump')));
      child.once('close', code => code === 0 ? resolve() : reject(new Error('pg_dump failed')));
    });
    let bytes = 0;
    const counter = new Transform({ transform(chunk, encoding, done) { bytes += chunk.length; done(null, chunk); } });
    const copy = pipeline(child.stdout, counter, createGzip(), fs.createWriteStream(temporary, { flags: 'wx', mode: 0o600 }));
    try { await Promise.all([exit, copy]); }
    catch (error) { child.kill(); await Promise.allSettled([exit, copy]); throw error; }
    if (!bytes) throw new Error('Empty database dump');
    await fs.promises.rename(temporary, file);
  } finally { await fs.promises.rm(temporary, { force: true }); }
  // Only prune this app's complete archives after successfully publishing a dump.
  const candidates = (await Promise.all((await fs.promises.readdir(directory))
    .filter(name => name.startsWith(`${prefix}_backup_`) && name.endsWith('.sql.gz'))
    .map(async name => ({ name, stat: await fs.promises.lstat(path.join(directory, name)) }))))
    .filter(entry => entry.stat.isFile() && entry.name !== filename).sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  for (const old of candidates.slice(keep - 1)) await fs.promises.unlink(path.join(directory, old.name));
  return file;
}
module.exports = { backupDatabase };

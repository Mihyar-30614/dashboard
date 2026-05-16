import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

let resolvedBin = null;

export function parseJlist(json) {
  const list = JSON.parse(json);
  const out = {};
  for (const p of list) {
    out[p.name] = {
      status: p.pm2_env?.status || "unknown",
      restarts: p.pm2_env?.restart_time ?? 0,
      cpu: p.monit?.cpu ?? 0,
      mem_bytes: p.monit?.memory ?? 0,
    };
  }
  return out;
}

async function which(cmd) {
  try {
    const { stdout } = await execFileP("/usr/bin/env", ["which", cmd], {
      timeout: 2_000,
    });
    const path = stdout.trim().split("\n")[0];
    return path || null;
  } catch {
    return null;
  }
}

async function resolvePm2Bin() {
  if (resolvedBin) return resolvedBin;
  const candidates = [
    process.env.PM2_BIN,
    "/usr/local/bin/pm2",
    "/usr/bin/pm2",
    "pm2",
  ].filter(Boolean);

  for (const bin of candidates) {
    try {
      await execFileP(bin, ["--version"], { timeout: 2_000 });
      resolvedBin = bin;
      return bin;
    } catch {
      /* try next */
    }
  }
  const found = await which("pm2");
  if (found) {
    resolvedBin = found;
    return found;
  }
  throw new Error("pm2_not_found");
}

export async function snapshot() {
  const bin = await resolvePm2Bin();
  const { stdout } = await execFileP(bin, ["jlist"], {
    timeout: 5_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return parseJlist(stdout);
}

export function _resetForTests() {
  resolvedBin = null;
}

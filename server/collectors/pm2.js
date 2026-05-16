import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

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

export async function snapshot() {
  const bin = process.env.PM2_BIN || "pm2";
  const { stdout } = await execFileP(bin, ["jlist"], {
    timeout: 5_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return parseJlist(stdout);
}

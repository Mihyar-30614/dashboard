import fs from "node:fs";

const LINE = /"\S+\s\S+\s\S+"\s(\d{3})\s\d+\s"[^"]*"\s"[^"]*"\s([\d.]+)\s*$/;

function pct(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

export async function aggregate(filepath, { fromOffset = 0 } = {}) {
  let nextOffset = fromOffset;
  let count = 0,
    errors = 0,
    errors_5xx = 0;
  const latencies = [];

  let stat;
  try {
    stat = await fs.promises.stat(filepath);
  } catch {
    return {
      count: 0,
      errors: 0,
      errors_5xx: 0,
      p95_ms: 0,
      nextOffset: 0,
      error: "log_unreadable",
    };
  }

  if (fromOffset > stat.size) fromOffset = 0;
  nextOffset = fromOffset;

  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filepath, {
      start: fromOffset,
      encoding: "utf8",
    });
    let buf = "";
    stream.on("data", (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        nextOffset += Buffer.byteLength(line, "utf8") + 1;
        const m = LINE.exec(line);
        if (!m) continue;
        const status = Number(m[1]);
        const ms = Number(m[2]) * 1000;
        count++;
        if (status >= 400) errors++;
        if (status >= 500) errors_5xx++;
        latencies.push(ms);
      }
    });
    stream.on("end", resolve);
    stream.on("error", reject);
  });

  return {
    count,
    errors,
    errors_5xx,
    p95_ms: Math.round(pct(latencies, 0.95)),
    nextOffset,
  };
}

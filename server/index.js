import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { buildApp } = await import("./app.js");
const { startPoller, stopPoller } = await import("./poller.js");
const { dbPool } = await import("./db.js");

const port =
  process.env.NODE_ENV === "production"
    ? Number(process.env.PORT || 4010)
    : Number(process.env.PORT_DEV || Number(process.env.PORT || 4010) + 100);

const host = process.env.HOST || "127.0.0.1";

const server = buildApp().listen(port, host, () => {
  console.log(`dashboard listening on ${host}:${port}`);
  if (process.env.POLLER !== "off") startPoller();
});

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  try {
    await Promise.all([new Promise(resolve => server.close(resolve)), stopPoller()]);
    await dbPool.end();
    clearTimeout(deadline);
    process.exit(0);
  } catch { process.exit(1); }
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { buildApp } = await import("./app.js");
const { startPoller } = await import("./poller.js");

const port =
  process.env.NODE_ENV === "production"
    ? Number(process.env.PORT || 4010)
    : Number(process.env.PORT_DEV || Number(process.env.PORT || 4010) + 100);

const host = process.env.HOST || "127.0.0.1";

buildApp().listen(port, host, () => {
  console.log(`dashboard listening on ${host}:${port}`);
  if (process.env.POLLER !== "off") startPoller();
});

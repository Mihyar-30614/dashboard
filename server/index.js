import "dotenv/config";
import { buildApp } from "./app.js";
import { startPoller } from "./poller.js";

const port =
  process.env.NODE_ENV === "production"
    ? Number(process.env.PORT || 4010)
    : Number(process.env.PORT_DEV || Number(process.env.PORT || 4010) + 100);

const host = process.env.HOST || "127.0.0.1";

buildApp().listen(port, host, () => {
  console.log(`dashboard listening on ${host}:${port}`);
  if (process.env.POLLER !== "off") startPoller();
});

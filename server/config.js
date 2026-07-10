import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
/** Password for the shared `dashboard_reader` role on app databases. */
export function dashboardReaderPassword() {
  return process.env.DASHBOARD_READER_PASSWORD ?? "";
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultPath = path.resolve(__dirname, "../config/apps.json");

export function loadApps(p = defaultPath) {
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  const password = dashboardReaderPassword();
  return Object.fromEntries(
    Object.entries(raw).map(([slug, def]) => [
      slug,
      { slug, ...def, db: { ...def.db, password } },
    ]),
  );
}

export function validScreens(appsPath = defaultPath) {
  return new Set(["overview", ...Object.keys(loadApps(appsPath))]);
}

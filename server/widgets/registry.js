import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const widgetsPath = path.resolve(__dirname, "../../config/widgets.json");

export const WIDGETS = JSON.parse(readFileSync(widgetsPath, "utf8"));
export const KIND_INDEX = Object.fromEntries(WIDGETS.map((w) => [w.kind, w]));

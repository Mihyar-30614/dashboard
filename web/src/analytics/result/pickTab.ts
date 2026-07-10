import type { ResultTab } from "../types";
import { isDateValue, isNumericValue } from "../../lib/format";

type Row = Record<string, unknown>;

function isNumericCol(rows: Row[], col: string): boolean {
  let seen = 0;
  for (const r of rows) {
    const v = r[col];
    if (v === null || v === undefined) continue;
    if (!isNumericValue(v)) return false;
    seen++;
  }
  return seen > 0;
}

function isDateCol(rows: Row[], col: string): boolean {
  let seen = 0;
  for (const r of rows) {
    const v = r[col];
    if (v === null || v === undefined) continue;
    if (!isDateValue(v)) return false;
    seen++;
  }
  return seen > 0;
}

function isCategoricalCol(rows: Row[], col: string): boolean {
  for (const r of rows) {
    const v = r[col];
    if (v === null || v === undefined) continue;
    if (typeof v !== "string") return false;
    if (isDateValue(v)) return false;
    if (isNumericValue(v)) return false;
  }
  return true;
}

export function pickTab(rows: Row[]): ResultTab {
  if (rows.length === 0) return "table";

  const cols = Array.from(
    rows.reduce<Set<string>>((s, r) => {
      for (const k of Object.keys(r)) s.add(k);
      return s;
    }, new Set()),
  );

  if (rows.length === 1 && cols.length === 1) return "table";

  const numericCols = cols.filter((c) => isNumericCol(rows, c));
  const dateCols = cols.filter((c) => isDateCol(rows, c));
  const categoricalCols = cols.filter((c) => isCategoricalCol(rows, c));

  if (numericCols.length === 0) return "table";

  if (dateCols.length > 0) return "chart";

  if (categoricalCols.length > 0 && rows.length <= 30) return "chart";

  return "table";
}

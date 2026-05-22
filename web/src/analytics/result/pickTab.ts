import type { ResultTab } from "../types";

type Row = Record<string, unknown>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}|$)/;

function isNumericCol(rows: Row[], col: string): boolean {
  let seen = 0;
  for (const r of rows) {
    const v = r[col];
    if (v === null || v === undefined) continue;
    if (typeof v === "number" && Number.isFinite(v)) {
      seen++;
      continue;
    }
    return false;
  }
  return seen > 0;
}

function isDateCol(rows: Row[], col: string): boolean {
  let seen = 0;
  for (const r of rows) {
    const v = r[col];
    if (v === null || v === undefined) continue;
    if (v instanceof Date) {
      seen++;
      continue;
    }
    if (typeof v === "string" && DATE_RE.test(v)) {
      seen++;
      continue;
    }
    return false;
  }
  return seen > 0;
}

function isCategoricalCol(rows: Row[], col: string): boolean {
  for (const r of rows) {
    const v = r[col];
    if (v === null || v === undefined) continue;
    if (typeof v !== "string") return false;
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

  if (numericCols.length >= 1 && dateCols.length >= 1) return "chart";

  if (cols.length === 2 && numericCols.length === 1 && rows.length <= 30) {
    const otherCol = cols.find((c) => c !== numericCols[0])!;
    if (isCategoricalCol(rows, otherCol)) return "chart";
  }

  return "table";
}

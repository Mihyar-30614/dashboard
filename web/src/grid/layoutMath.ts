/**
 * Pure grid geometry. The saved 12-column layout is the only source of truth;
 * every narrower layout is derived from it so a resize cycle can never drift.
 */

export type Box = { id: string; x: number; y: number; w: number; h: number };

export const MAX_COLUMNS = 12;

/** Column count for a canvas width (px). Above 760 the saved layout is used as-is. */
export function columnsForWidth(width: number): 12 | 6 | 1 {
  if (width > 760) return 12;
  if (width > 520) return 6;
  return 1;
}

/** Top-to-bottom, then left-to-right — the order a person scans the board. */
export function readingOrder<T extends Box>(boxes: T[]): T[] {
  return [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Derive the layout for `column` columns from the canonical 12-column one.
 * Items keep reading order and height; widths scale (never below a third of
 * the row at 6 columns) and are packed into the lowest free slot so nothing
 * leaves a hole or jumps ahead of an item that came before it.
 */
export function layoutForColumns<T extends Box>(boxes: T[], column: number): T[] {
  if (column >= MAX_COLUMNS) return boxes.map((b) => ({ ...b }));
  const ordered = readingOrder(boxes);
  if (column === 1) {
    let y = 0;
    return ordered.map((b) => {
      const out = { ...b, x: 0, y, w: 1 };
      y += b.h;
      return out;
    });
  }
  const minW = Math.max(1, Math.round(column / 3));
  const heights = new Array<number>(column).fill(0);
  let floor = 0; // top of the previous item: later items never sit above it
  return ordered.map((b) => {
    const w = Math.min(column, Math.max(minW, Math.round((b.w * column) / MAX_COLUMNS)));
    let bestX = 0;
    let bestY = Infinity;
    for (let x = 0; x + w <= column; x++) {
      const y = Math.max(floor, ...heights.slice(x, x + w));
      if (y < bestY) {
        bestY = y;
        bestX = x;
      }
    }
    for (let x = bestX; x < bestX + w; x++) heights[x] = bestY + b.h;
    floor = bestY;
    return { ...b, x: bestX, y: bestY, w };
  });
}

/** Split `total` across `weights` proportionally, every share ≥ 1, summing exactly to `total`. */
function apportion(weights: number[], total: number): number[] {
  const sum = weights.reduce((s, v) => s + v, 0);
  const raw = weights.map((v) => (v / sum) * total);
  const out = raw.map((v) => Math.max(1, Math.floor(v)));
  let left = total - out.reduce((s, v) => s + v, 0);
  const byRemainder = raw
    .map((v, i) => ({ i, r: v - Math.floor(v) }))
    .sort((a, b) => b.r - a.r);
  for (let k = 0; left > 0; k = (k + 1) % byRemainder.length, left--) {
    out[byRemainder[k].i]++;
  }
  for (let k = out.length - 1; left < 0 && k >= 0; k--) {
    while (out[k] > 1 && left < 0) {
      out[k]--;
      left++;
    }
  }
  return out;
}

/**
 * Re-arrange into tidy full-width rows. Rows are seeded in reading order and
 * filled with later items of the same height that still fit, then widths are
 * stretched so each row spans all 12 columns. No gaps, no ragged edges, and
 * sizes stay proportional to what the user picked.
 */
export function bestFitLayout<T extends Box>(boxes: T[]): T[] {
  const pending = readingOrder(boxes);
  const out: T[] = [];
  let y = 0;
  while (pending.length) {
    const row = [pending.shift()!];
    let used = Math.min(row[0].w, MAX_COLUMNS);
    for (let i = 0; i < pending.length && used < MAX_COLUMNS; ) {
      const b = pending[i];
      if (b.h === row[0].h && used + b.w <= MAX_COLUMNS) {
        row.push(b);
        used += b.w;
        pending.splice(i, 1);
      } else {
        i++;
      }
    }
    const widths = apportion(
      row.map((b) => Math.min(b.w, MAX_COLUMNS)),
      MAX_COLUMNS,
    );
    let x = 0;
    row.forEach((b, i) => {
      out.push({ ...b, x, y, w: widths[i] });
      x += widths[i];
    });
    y += row[0].h;
  }
  return out;
}

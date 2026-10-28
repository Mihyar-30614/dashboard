import { describe, it, expect } from "vitest";
import {
  bestFitLayout,
  columnsForWidth,
  layoutForColumns,
  type Box,
} from "@/grid/layoutMath";

// Two KPI tiles over two side-by-side charts — the seeded board.
const board: Box[] = [
  { id: "d4", x: 6, y: 2, w: 6, h: 4 },
  { id: "d1", x: 0, y: 0, w: 2, h: 2 },
  { id: "d3", x: 0, y: 2, w: 6, h: 4 },
  { id: "d2", x: 2, y: 0, w: 2, h: 2 },
];

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function assertValid(boxes: Box[], column: number) {
  for (const b of boxes) {
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w).toBeLessThanOrEqual(column);
  }
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++)
      expect(overlaps(boxes[i], boxes[j])).toBe(false);
}

describe("columnsForWidth", () => {
  it("keeps 12 columns on desktop canvases and steps down when narrow", () => {
    expect(columnsForWidth(1100)).toBe(12);
    expect(columnsForWidth(761)).toBe(12);
    expect(columnsForWidth(700)).toBe(6);
    expect(columnsForWidth(400)).toBe(1);
  });
});

describe("layoutForColumns", () => {
  it("returns the saved layout untouched at 12 columns", () => {
    expect(layoutForColumns(board, 12)).toEqual(board);
  });

  it("stacks in reading order at 1 column", () => {
    const out = layoutForColumns(board, 1);
    expect(out.map((b) => b.id)).toEqual(["d1", "d2", "d3", "d4"]);
    expect(out.map((b) => b.y)).toEqual([0, 2, 4, 8]);
    expect(out.every((b) => b.x === 0 && b.w === 1)).toBe(true);
  });

  it("keeps rows together at 6 columns", () => {
    const out = layoutForColumns(board, 6);
    const by = Object.fromEntries(out.map((b) => [b.id, b]));
    assertValid(out, 6);
    expect(by.d1).toMatchObject({ x: 0, y: 0, w: 2 });
    expect(by.d2).toMatchObject({ x: 2, y: 0, w: 2 });
    expect(by.d3).toMatchObject({ x: 0, y: 2, w: 3 });
    expect(by.d4).toMatchObject({ x: 3, y: 2, w: 3 });
  });

  it("never places a later item above an earlier one", () => {
    const tall: Box[] = [
      { id: "a", x: 0, y: 0, w: 12, h: 2 },
      { id: "b", x: 0, y: 2, w: 4, h: 6 },
      { id: "c", x: 4, y: 2, w: 8, h: 2 },
      { id: "d", x: 4, y: 4, w: 4, h: 2 },
    ];
    const out = layoutForColumns(tall, 6);
    assertValid(out, 6);
    const ys = out.map((b) => b.y);
    expect([...ys].sort((p, q) => p - q)).toEqual(ys);
  });
});

describe("bestFitLayout", () => {
  it("fills every row edge to edge without gaps", () => {
    const out = bestFitLayout(board);
    assertValid(out, 12);
    const by = Object.fromEntries(out.map((b) => [b.id, b]));
    expect(by.d1).toMatchObject({ x: 0, y: 0, w: 6, h: 2 });
    expect(by.d2).toMatchObject({ x: 6, y: 0, w: 6, h: 2 });
    expect(by.d3).toMatchObject({ x: 0, y: 2, w: 6, h: 4 });
    expect(by.d4).toMatchObject({ x: 6, y: 2, w: 6, h: 4 });
  });

  it("groups same-height widgets even when they were stacked apart", () => {
    const messy: Box[] = [
      { id: "k1", x: 0, y: 0, w: 3, h: 2 },
      { id: "chart", x: 3, y: 0, w: 9, h: 4 },
      { id: "k2", x: 0, y: 2, w: 3, h: 2 },
      { id: "k3", x: 0, y: 9, w: 2, h: 2 },
    ];
    const out = bestFitLayout(messy);
    assertValid(out, 12);
    const by = Object.fromEntries(out.map((b) => [b.id, b]));
    expect([by.k1.y, by.k2.y, by.k3.y]).toEqual([0, 0, 0]);
    expect(by.k1.w + by.k2.w + by.k3.w).toBe(12);
    expect(by.chart).toMatchObject({ x: 0, y: 2, w: 12, h: 4 });
  });

  it("splits a row that would overflow and keeps proportions", () => {
    const wide: Box[] = [
      { id: "a", x: 0, y: 0, w: 8, h: 3 },
      { id: "b", x: 8, y: 0, w: 4, h: 3 },
      { id: "c", x: 0, y: 3, w: 6, h: 3 },
    ];
    const out = bestFitLayout(wide);
    const by = Object.fromEntries(out.map((b) => [b.id, b]));
    expect(by.a).toMatchObject({ x: 0, y: 0, w: 8 });
    expect(by.b).toMatchObject({ x: 8, y: 0, w: 4 });
    expect(by.c).toMatchObject({ x: 0, y: 3, w: 12 });
  });

  it("keeps extra widget fields", () => {
    const out = bestFitLayout([{ id: "a", x: 3, y: 5, w: 3, h: 2, kind: "kpi" }]);
    expect(out[0]).toEqual({ id: "a", x: 0, y: 0, w: 12, h: 2, kind: "kpi" });
  });
});

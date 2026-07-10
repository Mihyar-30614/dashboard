import { describe, it, expect } from "vitest";
import {
  formatCell,
  formatDateValue,
  isDateValue,
  isNumericValue,
  toCsv,
} from "@/lib/format";

describe("formatCell", () => {
  it("renders em-dash for null", () => {
    expect(formatCell(null)).toBe("—");
  });
  it("renders em-dash for undefined", () => {
    expect(formatCell(undefined)).toBe("—");
  });
  it("stringifies objects", () => {
    expect(formatCell({ a: 1 })).toBe('{"a":1}');
  });
  it("stringifies arrays", () => {
    expect(formatCell([1, 2])).toBe("[1,2]");
  });
  it("coerces primitives", () => {
    expect(formatCell(42)).toBe("42");
    expect(formatCell("x")).toBe("x");
    expect(formatCell(true)).toBe("true");
  });
  it("formats postgres date strings for display", () => {
    expect(formatCell("2026-05-21")).not.toBe("2026-05-21");
    expect(formatCell("2026-05-21")).toMatch(/2026/);
    expect(formatCell("2026-05-21")).toMatch(/21/);
  });
  it("formats postgres timestamps for display", () => {
    expect(formatCell("2026-05-21T14:30:00Z")).not.toBe("2026-05-21T14:30:00Z");
    expect(formatCell("2026-05-21T14:30:00Z")).toMatch(/2026/);
  });
});

describe("formatDateValue", () => {
  it("returns null for non-dates", () => {
    expect(formatDateValue("hello")).toBeNull();
    expect(formatDateValue(42)).toBeNull();
  });
  it("formats date-only strings without timezone shift", () => {
    const out = formatDateValue("2026-05-21");
    expect(out).not.toBeNull();
    expect(out).toMatch(/May/);
    expect(out).toMatch(/21/);
    expect(out).toMatch(/2026/);
  });
});

describe("isNumericValue", () => {
  it("accepts finite numbers", () => {
    expect(isNumericValue(0)).toBe(true);
    expect(isNumericValue(-3.14)).toBe(true);
  });
  it("rejects NaN and Infinity", () => {
    expect(isNumericValue(NaN)).toBe(false);
    expect(isNumericValue(Infinity)).toBe(false);
  });
  it("accepts numeric strings (DB driver edge case)", () => {
    expect(isNumericValue("42")).toBe(true);
    expect(isNumericValue("-3.14")).toBe(true);
    expect(isNumericValue("0")).toBe(true);
  });
  it("rejects non-numeric strings", () => {
    expect(isNumericValue("hi")).toBe(false);
    expect(isNumericValue("1.2.3")).toBe(false);
    expect(isNumericValue("")).toBe(false);
  });
  it("rejects null/undefined/objects", () => {
    expect(isNumericValue(null)).toBe(false);
    expect(isNumericValue(undefined)).toBe(false);
    expect(isNumericValue({})).toBe(false);
  });
});

describe("isDateValue", () => {
  it("accepts Date instances", () => {
    expect(isDateValue(new Date())).toBe(true);
  });
  it("accepts ISO-like date strings", () => {
    expect(isDateValue("2026-05-21")).toBe(true);
    expect(isDateValue("2026-05-21T10:30")).toBe(true);
  });
  it("rejects other formats", () => {
    expect(isDateValue("May 21 2026")).toBe(false);
    expect(isDateValue("2026/05/21")).toBe(false);
    expect(isDateValue(20260521)).toBe(false);
  });
});

describe("toCsv (RFC 4180)", () => {
  it("returns empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });
  it("uses union of keys as header in insertion order", () => {
    const csv = toCsv([{ a: 1 }, { a: 2, b: 3 }]);
    expect(csv.split("\n")[0]).toBe("a,b");
  });
  it("quotes fields containing commas", () => {
    const csv = toCsv([{ a: "hi, there" }]);
    expect(csv).toBe('a\n"hi, there"');
  });
  it("escapes double quotes by doubling them", () => {
    const csv = toCsv([{ a: 'she said "hi"' }]);
    expect(csv).toBe('a\n"she said ""hi"""');
  });
  it("quotes fields with newlines", () => {
    const csv = toCsv([{ a: "line1\nline2" }]);
    expect(csv).toBe('a\n"line1\nline2"');
  });
  it("renders null as empty field", () => {
    const csv = toCsv([{ a: null, b: 1 }]);
    expect(csv).toBe("a,b\n,1");
  });
});

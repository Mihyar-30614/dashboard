import { describe, it, expect } from "vitest";
import { formatCell, toCsv } from "../format";

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

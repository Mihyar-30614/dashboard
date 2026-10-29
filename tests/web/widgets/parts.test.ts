import { describe, it, expect } from "vitest";
import { dayLabel, money, monthLabel, monthsSpan, pct } from "@/widgets/parts";

describe("insight formatters", () => {
  it("formats cents as currency, compacting large values on request", () => {
    expect(money(2941, "CAD")).toBe("$29.41");
    expect(money(561408, "CAD")).toBe("$5,614");
    expect(money(561408, "CAD", { compact: true })).toBe("$5.6K");
    expect(money(-29170, "CAD", { sign: true })).toBe("-$291.70");
    expect(money(null)).toBe("—");
  });

  it("labels months and days", () => {
    expect(monthLabel("2027-05")).toBe("May 2027");
    expect(monthLabel("2027-05", true)).toBe("May");
    expect(dayLabel("2026-10-26")).toBe("Oct 26");
  });

  it("spells month spans as years and months", () => {
    expect(monthsSpan(7)).toBe("7m");
    expect(monthsSpan(53)).toBe("4y 5m");
    expect(monthsSpan(0)).toBe("0m");
  });

  it("renders missing percentages as a dash", () => {
    expect(pct(null)).toBe("—");
    expect(pct(37.2)).toBe("37%");
  });
});

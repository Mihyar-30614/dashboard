import { describe, it, expect } from "vitest";
import { bucketColor, overallUptime } from "./UptimeStrip";

describe("bucketColor", () => {
  it("maps ratios to status colors", () => {
    expect(bucketColor(1, 10)).toBe("var(--ok)");
    expect(bucketColor(0.999, 10)).toBe("var(--ok)");
    expect(bucketColor(0.9, 10)).toBe("var(--warn)");
    expect(bucketColor(0.2, 10)).toBe("var(--bad)");
    expect(bucketColor(null, 0)).toBe("var(--rule)");
  });
});

describe("overallUptime", () => {
  it("weights by sample count", () => {
    expect(
      overallUptime([
        { bucket: 1, ratio: 1, samples: 90 },
        { bucket: 2, ratio: 0, samples: 10 },
        { bucket: 3, ratio: null, samples: 0 },
      ]),
    ).toBeCloseTo(0.9);
  });
  it("returns null with no samples", () => {
    expect(overallUptime([{ bucket: 1, ratio: null, samples: 0 }])).toBeNull();
  });
});

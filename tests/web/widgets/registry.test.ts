import { describe, it, expect } from "vitest";
import widgetsMeta from "@config/widgets.json";
import { WIDGETS } from "@/widgets/registry";

describe("widget registry", () => {
  it("has a component for every kind in widgets.json", () => {
    for (const w of widgetsMeta) {
      expect(WIDGETS[w.kind]?.Component, `missing component for ${w.kind}`).toBeDefined();
    }
  });

  it("does not define components absent from widgets.json", () => {
    const kinds = new Set(widgetsMeta.map((w) => w.kind));
    for (const kind of Object.keys(WIDGETS)) {
      expect(kinds.has(kind), `orphan component for ${kind}`).toBe(true);
    }
  });
});

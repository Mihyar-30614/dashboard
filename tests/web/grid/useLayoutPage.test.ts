import { describe, it, expect } from "vitest";
import { sqlDefaultSize, effectiveParams } from "@/grid/useLayoutPage";

describe("effectiveParams", () => {
  it("fills range from the page when unset", () => {
    expect(effectiveParams({ key: "mrr" }, "7d")).toEqual({ key: "mrr", range: "7d" });
    expect(effectiveParams(undefined, "90d")).toEqual({ range: "90d" });
  });

  it("keeps an explicitly pinned range", () => {
    expect(effectiveParams({ range: "90d" }, "7d")).toEqual({ range: "90d" });
  });
});

describe("sqlDefaultSize", () => {
  it("gives charts and tables room", () => {
    expect(sqlDefaultSize("line")).toEqual({ w: 6, h: 4 });
    expect(sqlDefaultSize("bar")).toEqual({ w: 6, h: 4 });
    expect(sqlDefaultSize("table")).toEqual({ w: 6, h: 4 });
  });

  it("keeps numbers compact", () => {
    expect(sqlDefaultSize("number")).toEqual({ w: 3, h: 2 });
    expect(sqlDefaultSize(undefined)).toEqual({ w: 3, h: 2 });
  });
});

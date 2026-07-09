import { describe, it, expect } from "vitest";
import { sqlDefaultSize } from "./useLayoutPage";

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

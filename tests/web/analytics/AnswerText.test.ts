import { describe, it, expect } from "vitest";
import { tokenize } from "@/analytics/result/AnswerText";

describe("tokenize", () => {
  it("parses bold, italic, code", () => {
    const t = tokenize("There is no **meat** with `bought_at` or *missing*.");
    expect(t.map((x) => x.type)).toEqual([
      "text",
      "bold",
      "text",
      "code",
      "text",
      "italic",
      "text",
    ]);
    expect(t[1]).toMatchObject({ type: "bold", value: "meat" });
    expect(t[3]).toMatchObject({ type: "code", value: "bought_at" });
    expect(t[5]).toMatchObject({ type: "italic", value: "missing" });
  });

  it("detects ISO date and datetime", () => {
    const t = tokenize("Bought on 2026-05-25 at 2026-05-25T14:30:00Z.");
    const types = t.map((x) => x.type);
    expect(types).toContain("date");
    expect(types).toContain("datetime");
  });

  it("detects USD and currency-code money", () => {
    const t = tokenize("Spent $1,234.56 and EUR 99.");
    const moneys = t.filter((x) => x.type === "money");
    expect(moneys).toHaveLength(2);
    expect(moneys[0]).toMatchObject({ currency: "USD" });
    expect(moneys[1]).toMatchObject({ currency: "EUR" });
  });

  it("leaves plain text alone", () => {
    const t = tokenize("just plain text here");
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ type: "text", value: "just plain text here" });
  });
});

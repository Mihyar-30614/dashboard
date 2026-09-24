import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Caveats from "@/analytics/result/Caveats";

describe("Caveats", () => {
  it("lists each caveat Seer reported", () => {
    render(
      <Caveats
        caveats={[
          "Served from the answer cache; the data may have changed since.",
          "The first 1 SQL attempt(s) failed; this answer comes from a retry.",
        ]}
      />,
    );
    const list = screen.getByLabelText("Answer caveats");
    expect(list.querySelectorAll("li")).toHaveLength(2);
    expect(screen.getByText(/answer cache/)).toBeTruthy();
  });

  it.each([undefined, null, []])("renders nothing for %s", (caveats) => {
    const { container } = render(<Caveats caveats={caveats as string[] | null | undefined} />);
    expect(container.firstChild).toBeNull();
  });
});

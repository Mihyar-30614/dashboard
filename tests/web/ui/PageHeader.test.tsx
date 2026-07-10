import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PageHeader from "@/ui/PageHeader";

describe("PageHeader", () => {
  it("renders eyebrow and title", () => {
    render(<PageHeader eyebrow="overview · all properties" title="Overview" />);
    expect(screen.getByText("overview · all properties")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Overview" })).toBeInTheDocument();
  });

  it("renders meta, stats, and actions when provided", () => {
    render(
      <PageHeader
        eyebrow="property"
        title="Sportly"
        meta={<span>slug: sportly · pm2: online</span>}
        stats={[{ k: "apps", v: 4 }, { k: "online", v: "3/4", tone: "warn" }]}
        actions={<button type="button">Add widget</button>}
      />,
    );
    expect(screen.getByText("slug: sportly · pm2: online")).toBeInTheDocument();
    expect(screen.getByTestId("page-header-summary")).toHaveTextContent("4 apps");
    expect(screen.getByTestId("page-header-summary")).toHaveTextContent("3/4 online");
    expect(screen.getByRole("button", { name: "Add widget" })).toBeInTheDocument();
  });

  it("omits meta/stats/actions blocks when not provided", () => {
    render(<PageHeader eyebrow="settings · workspace" title="Access & invites" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

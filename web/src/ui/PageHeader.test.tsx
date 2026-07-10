import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PageHeader from "./PageHeader";

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
        stats={[{ k: "Apps", v: 4 }, { k: "Online", v: "3/4" }]}
        actions={<button type="button">Add widget</button>}
      />,
    );
    expect(screen.getByText("slug: sportly · pm2: online")).toBeInTheDocument();
    expect(screen.getByText("Apps")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add widget" })).toBeInTheDocument();
  });

  it("omits meta/stats/actions blocks when not provided", () => {
    render(<PageHeader eyebrow="settings · workspace" title="Access & invites" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

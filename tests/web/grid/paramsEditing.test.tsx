import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ParamsEditingContext, ParamsPopover, editableFields } from "@/grid/paramsEditing";
import WidgetFrame from "@/grid/WidgetFrame";

const RANGE_FIELD = {
  name: "range",
  type: "enum" as const,
  values: ["7d", "30d", "90d"],
  default: "30d",
};

describe("editableFields", () => {
  it("hides widget_id from editing", () => {
    expect(
      editableFields([{ name: "widget_id", type: "number" }, RANGE_FIELD]),
    ).toEqual([RANGE_FIELD]);
  });
});

describe("ParamsPopover", () => {
  it("renders an enum field as a select with the current value", () => {
    render(
      <ParamsPopover
        schema={[RANGE_FIELD]}
        params={{ range: "7d" }}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    const select = screen.getByLabelText("range") as HTMLSelectElement;
    expect(select.value).toBe("7d");
  });

  it("falls back to the schema default for non-range fields", () => {
    render(
      <ParamsPopover
        schema={[{ name: "chart_type", type: "enum", values: ["line", "bar"], default: "line" }]}
        params={{}}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    expect((screen.getByLabelText("chart_type") as HTMLSelectElement).value).toBe("line");
  });

  it("shows page default for an unset range", () => {
    render(
      <ParamsPopover
        schema={[RANGE_FIELD]}
        params={{}}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    expect((screen.getByLabelText("range") as HTMLSelectElement).value).toBe("");
  });

  it("applies edited values", () => {
    const onSave = vi.fn();
    render(
      <ParamsPopover
        schema={[RANGE_FIELD, { name: "key", type: "string", required: true }]}
        params={{ range: "30d", key: "mrr" }}
        onSave={onSave}
        onClose={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText("range"), { target: { value: "90d" } });
    fireEvent.change(screen.getByLabelText("key"), { target: { value: "arr" } });
    fireEvent.click(screen.getByText("Apply"));
    expect(onSave).toHaveBeenCalledWith({ range: "90d", key: "arr" });
  });
});

describe("ParamsPopover range unpinning", () => {
  it("offers a page-default option for range and drops the key on save", () => {
    const onSave = vi.fn();
    render(
      <ParamsPopover
        schema={[RANGE_FIELD]}
        params={{ range: "90d" }}
        onSave={onSave}
        onClose={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText("range"), { target: { value: "" } });
    fireEvent.click(screen.getByText("Apply"));
    expect(onSave).toHaveBeenCalledWith({});
  });
});

describe("WidgetFrame gear", () => {
  it("shows no gear without an editing context", () => {
    render(<WidgetFrame title="t">x</WidgetFrame>);
    expect(screen.queryByLabelText("Widget settings")).toBeNull();
  });

  it("shows no gear when nothing is editable", () => {
    render(
      <ParamsEditingContext.Provider
        value={{ schema: [{ name: "widget_id", type: "number" }], params: {}, onSave: () => {} }}
      >
        <WidgetFrame title="t">x</WidgetFrame>
      </ParamsEditingContext.Provider>,
    );
    expect(screen.queryByLabelText("Widget settings")).toBeNull();
  });

  it("opens the popover and saves through the context", () => {
    const onSave = vi.fn();
    render(
      <ParamsEditingContext.Provider
        value={{ schema: [RANGE_FIELD], params: { range: "30d" }, onSave }}
      >
        <WidgetFrame title="t">x</WidgetFrame>
      </ParamsEditingContext.Provider>,
    );
    fireEvent.click(screen.getByLabelText("Widget settings"));
    fireEvent.change(screen.getByLabelText("range"), { target: { value: "7d" } });
    fireEvent.click(screen.getByText("Apply"));
    expect(onSave).toHaveBeenCalledWith({ range: "7d" });
  });
});

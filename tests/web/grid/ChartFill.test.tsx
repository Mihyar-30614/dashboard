import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import ChartFill from "@/grid/ChartFill";

class FakeResizeObserver {
  cb: ResizeObserverCallback;
  static last: FakeResizeObserver | null = null;
  el: Element | null = null;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
    FakeResizeObserver.last = this;
  }
  observe(el: Element) {
    this.el = el;
    this.fire(240, 120);
  }
  fire(width: number, height: number) {
    if (!this.el) return;
    Object.defineProperty(this.el, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          width,
          height,
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          bottom: height,
          right: width,
          toJSON() {
            return this;
          },
        }) as DOMRect,
    });
    this.cb(
      [
        {
          target: this.el,
          contentRect: {
            width,
            height,
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            bottom: height,
            right: width,
            toJSON() {
              return this;
            },
          } as DOMRectReadOnly,
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        },
      ],
      this as unknown as ResizeObserver,
    );
  }
  unobserve() {}
  disconnect() {}
}

describe("ChartFill", () => {
  beforeEach(() => {
    FakeResizeObserver.last = null;
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sizes the child chart to the observed box", async () => {
    function Probe(props: { width?: number; height?: number }) {
      return (
        <div data-testid="probe">
          {props.width}x{props.height}
        </div>
      );
    }
    render(
      <div style={{ width: 240, height: 120 }}>
        <ChartFill>
          <Probe />
        </ChartFill>
      </div>,
    );
    await act(async () => {});
    expect(screen.getByTestId("probe")).toHaveTextContent("240x120");
  });

  it("re-sizes when the host shrinks (window resize path)", async () => {
    function Probe(props: { width?: number; height?: number }) {
      return (
        <div data-testid="probe">
          {props.width}x{props.height}
        </div>
      );
    }
    render(
      <div style={{ width: 240, height: 120 }}>
        <ChartFill>
          <Probe />
        </ChartFill>
      </div>,
    );
    await act(async () => {});
    expect(screen.getByTestId("probe")).toHaveTextContent("240x120");

    await act(async () => {
      FakeResizeObserver.last?.fire(160, 120);
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.getByTestId("probe")).toHaveTextContent("160x120");
  });
});

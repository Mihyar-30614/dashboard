import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

(window as any).ResizeObserver = class ResizeObserver {
  private cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) { this.cb = cb; }
  observe(_target: Element) {
    this.cb([{ contentRect: { width: 400, height: 200 } } as ResizeObserverEntry], this);
  }
  unobserve() {}
  disconnect() {}
};

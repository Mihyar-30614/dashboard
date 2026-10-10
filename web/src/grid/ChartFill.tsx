import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

type Size = { w: number; h: number };

/**
 * Fills the parent and sizes a Recharts chart to the live box.
 *
 * Important: measure via an absolutely positioned inset layer so the SVG
 * cannot inflate the host. Plain % height + content-sized flex lets a fixed
 * chart lock the box — ResizeObserver then never sees window shrink.
 */
export default function ChartFill({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const apply = () => {
      const r = host.getBoundingClientRect();
      const nw = Math.max(0, Math.floor(r.width));
      const nh = Math.max(0, Math.floor(r.height));
      setSize((prev) =>
        prev.w === nw && prev.h === nh ? prev : { w: nw, h: nh },
      );
    };

    apply();

    const ro = new ResizeObserver(() => apply());
    ro.observe(host);

    // GridStack / sidebar collapse can change layout without always
    // delivering a contentRect tick on every nested flex child.
    window.addEventListener("resize", apply);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);

  let chart: ReactNode = null;
  if (size.w > 0 && size.h > 0 && isValidElement(children)) {
    chart = cloneElement(
      children as ReactElement<{ width?: number; height?: number }>,
      { width: size.w, height: size.h },
    );
  }

  return (
    <div ref={hostRef} className="chart-fill" data-testid="chart-fill">
      <div className="chart-fill__stage">{chart}</div>
    </div>
  );
}

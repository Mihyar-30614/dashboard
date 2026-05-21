type Variant = "block" | "metric" | "chart" | "line";

export default function Skeleton({
  variant = "block",
  width,
  height,
}: {
  variant?: Variant;
  width?: number | string;
  height?: number | string;
}) {
  if (variant === "metric") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          justifyContent: "center",
          height: "100%",
        }}
      >
        <span
          className="skeleton"
          style={{ height: 28, width: width ?? 96 }}
          aria-hidden
        />
        <span
          className="skeleton"
          style={{ height: 10, width: 64 }}
          aria-hidden
        />
      </div>
    );
  }
  if (variant === "chart") {
    return (
      <div
        className="skeleton"
        style={{
          width: width ?? "100%",
          height: height ?? "100%",
          minHeight: 60,
        }}
        aria-hidden
      />
    );
  }
  if (variant === "line") {
    return (
      <span
        className="skeleton"
        style={{
          display: "inline-block",
          height: 12,
          width: width ?? 80,
          verticalAlign: "middle",
        }}
        aria-hidden
      />
    );
  }
  return (
    <div
      className="skeleton"
      style={{ width: width ?? "100%", height: height ?? 16 }}
      aria-hidden
    />
  );
}

import { type ReactNode, useState } from "react";

export default function RailSection({
  title,
  count,
  defaultOpen = true,
  actions,
  onToggle,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  actions?: ReactNode;
  onToggle?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      className="an-rail__section"
      open={open}
      onToggle={(e) => {
        const next = (e.currentTarget as HTMLDetailsElement).open;
        setOpen(next);
        onToggle?.(next);
      }}
    >
      <summary>
        <span className="eyebrow" style={{ flex: 1 }}>
          {title}
        </span>
        {typeof count === "number" && (
          <span className="an-rail__count">{count}</span>
        )}
        {actions}
      </summary>
      <div className="an-rail__section-body">{children}</div>
    </details>
  );
}

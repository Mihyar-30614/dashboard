import { type ReactNode } from "react";

export default function LeftRail({
  isOpen,
  onClose,
  top,
  sections,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Pinned above the scrolling sections. */
  top?: ReactNode;
  sections: ReactNode;
}) {
  return (
    <>
      <aside className={"an-rail" + (isOpen ? " is-open" : "")}>
        {top}
        <div className="an-rail__sections">{sections}</div>
      </aside>
      {isOpen && <div onClick={onClose} className="an-rail__backdrop" />}
    </>
  );
}

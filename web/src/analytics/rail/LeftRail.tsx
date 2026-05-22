import { type ReactNode } from "react";

export default function LeftRail({
  isOpen,
  onClose,
  sections,
  composer,
}: {
  isOpen: boolean;
  onClose: () => void;
  sections: ReactNode;
  composer: ReactNode;
}) {
  return (
    <>
      <aside className={"an-rail" + (isOpen ? " is-open" : "")}>
        <div className="an-rail__sections">{sections}</div>
        {composer}
      </aside>
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            zIndex: 40,
            display: "none",
          }}
          className="an-rail__backdrop"
        />
      )}
    </>
  );
}

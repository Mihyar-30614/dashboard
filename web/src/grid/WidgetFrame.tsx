import React, { useContext, useState } from "react";
import { Maximize2, Settings2, X } from "lucide-react";
import { ParamsEditingContext, ParamsPopover, editableFields } from "./paramsEditing";
import { ExpandContext } from "./expandContext";
import { LayoutEditContext } from "./layoutEditContext";

type Props = {
  title: string;
  /** eyebrow = mono uppercase (default). label = display title for KPI-style widgets. */
  titleVariant?: "eyebrow" | "label";
  onRemove?: () => void;
  error?: string | null;
  stale?: boolean;
  meta?: string;
  children: React.ReactNode;
};

export default function WidgetFrame({
  title,
  titleVariant = "eyebrow",
  onRemove,
  error,
  stale,
  meta,
  children,
}: Props) {
  const editing = useContext(ParamsEditingContext);
  const expand = useContext(ExpandContext);
  const { editing: layoutEditing } = useContext(LayoutEditContext);
  const fields = editing ? editableFields(editing.schema) : [];
  const [settingsOpen, setSettingsOpen] = useState(false);
  const showEditChrome = layoutEditing;
  return (
    <div
      className="panel fade-up"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        className={showEditChrome ? "widget-drag-handle" : undefined}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 14,
          gap: 8,
          cursor: showEditChrome ? "grab" : "default",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
          {titleVariant === "label" ? (
            <h3 className="widget-title">{title}</h3>
          ) : (
            <span className="eyebrow">{title}</span>
          )}
          {meta && (
            <span className={titleVariant === "label" ? "widget-context" : undefined}
              style={
                titleVariant === "label"
                  ? undefined
                  : {
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }
              }
            >
              {meta}
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {error && (
            <span
              title={error}
              style={{ color: "var(--bad)", display: "flex", gap: 4 }}
            >
              <span className="led led--bad" /> err
            </span>
          )}
          {stale && <span style={{ color: "var(--muted)" }}>stale</span>}
          {expand && (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={expand.onExpand}
              title="Expand widget"
              aria-label="Expand widget"
              style={{
                width: 22,
                height: 22,
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Maximize2 size={12} strokeWidth={1.8} />
            </button>
          )}
          {showEditChrome && editing && fields.length > 0 && (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setSettingsOpen((o) => !o)}
              title="Widget settings"
              aria-label="Widget settings"
              style={{
                width: 22,
                height: 22,
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Settings2 size={12} strokeWidth={1.8} />
            </button>
          )}
          {showEditChrome && onRemove && (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onRemove}
              title="Remove widget"
              aria-label="Remove widget"
              style={{
                width: 22,
                height: 22,
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={12} strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>
      {settingsOpen && editing && (
        <ParamsPopover
          schema={editing.schema}
          params={editing.params}
          onSave={editing.onSave}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      <div
        className="widget-frame__body"
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  );
}

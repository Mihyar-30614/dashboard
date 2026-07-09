import { createContext, useState } from "react";

export type ParamField = {
  name: string;
  type: "enum" | "string" | "number";
  values?: string[];
  default?: string | number;
  required?: boolean;
};

export type ParamsEditing = {
  schema: ParamField[];
  params: Record<string, unknown>;
  onSave: (params: Record<string, unknown>) => void;
};

// Provided per grid item by useLayoutPage so WidgetFrame can offer param
// editing without every widget component plumbing props through.
export const ParamsEditingContext = createContext<ParamsEditing | null>(null);

// widget_id ties a sql widget to its saved query; the palette manages it.
export function editableFields(schema: ParamField[]): ParamField[] {
  return schema.filter((f) => f.name !== "widget_id");
}

// range follows the page-level picker unless explicitly pinned here, so it
// gets a "page default" option and no schema-default backfill.
function followsPage(f: ParamField) {
  return f.name === "range" && f.type === "enum";
}

export function ParamsPopover({
  schema,
  params,
  onSave,
  onClose,
}: {
  schema: ParamField[];
  params: Record<string, unknown>;
  onSave: (params: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const fields = editableFields(schema);
  const [draft, setDraft] = useState<Record<string, unknown>>(() => {
    const d: Record<string, unknown> = { ...params };
    for (const f of fields) {
      if (d[f.name] === undefined && f.default !== undefined && !followsPage(f)) {
        d[f.name] = f.default;
      }
    }
    return d;
  });

  function set(name: string, value: string) {
    setDraft((d) => ({ ...d, [name]: value }));
  }

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: 34,
        right: 8,
        zIndex: 10,
        minWidth: 180,
        padding: 12,
        background: "var(--panel)",
        border: "1px solid var(--rule)",
        borderRadius: 6,
        boxShadow: "0 8px 30px -12px rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {fields.map((f) => (
        <label
          key={f.name}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          {f.name}
          {f.type === "enum" ? (
            <select
              value={String(draft[f.name] ?? "")}
              onChange={(e) => set(f.name, e.target.value)}
            >
              {followsPage(f) && <option value="">page default</option>}
              {(f.values ?? []).map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          ) : (
            <input
              type={f.type === "number" ? "number" : "text"}
              value={String(draft[f.name] ?? "")}
              onChange={(e) => set(f.name, e.target.value)}
            />
          )}
        </label>
      ))}
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button type="button" onClick={onClose}>Cancel</button>
        <button
          type="button"
          onClick={() => {
            const out = { ...draft };
            for (const f of fields) {
              if (out[f.name] === "") delete out[f.name];
              else if (f.type === "number" && out[f.name] !== undefined) {
                out[f.name] = Number(out[f.name]);
              }
            }
            onSave(out);
            onClose();
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}

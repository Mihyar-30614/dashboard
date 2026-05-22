import { useState } from "react";
import type { SchemaInfo } from "../../api/llm";

export default function SchemaTree({
  schema,
  loading,
  err,
  onColumnClick,
}: {
  schema: SchemaInfo | null;
  loading: boolean;
  err: string | null;
  onColumnClick: (insertion: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (err) return <div className="an-rail__empty">Schema error: {err}</div>;
  if (loading) return <div className="an-rail__empty">Loading schema…</div>;
  if (!schema) return <div className="an-rail__empty">No schema loaded.</div>;

  const toggle = (t: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  return (
    <>
      {schema.tables.map((t) => (
        <div key={t} className="an-schema__table">
          <button
            type="button"
            className="an-rail__item"
            onClick={() => toggle(t)}
          >
            <span style={{ flex: 1 }}>
              {expanded.has(t) ? "▾" : "▸"} {t}
            </span>
          </button>
          {expanded.has(t) && (
            <div className="an-schema__cols">
              {(schema.schemas[t] ?? []).map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className="an-schema__col"
                  onClick={() => onColumnClick(`${t}.${c.name}`)}
                  title={`${t}.${c.name} (${c.type})`}
                >
                  {c.name}
                  <span className="an-schema__col-type">{c.type}</span>
                </button>
              ))}
              {(schema.schemas[t] ?? []).length === 0 && (
                <div className="an-rail__empty">No columns.</div>
              )}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

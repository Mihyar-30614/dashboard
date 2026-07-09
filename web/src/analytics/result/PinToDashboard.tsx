import { useState } from "react";
import { useMe } from "../../api/hooks";
import {
  useSqlDataSources,
  useSqlPreview,
  useCreateSqlWidget,
  type PreviewResult,
} from "../../api/sqlWidgets";
import type { QA } from "../types";

// Turns an Ask DB answer into a saved SQL widget available in every
// dashboard palette. Admin-only: widget creation executes arbitrary SQL
// server-side, so it mirrors the sql-widgets route permissions.
export default function PinToDashboard({
  qa,
  dbName,
  onToast,
  open,
  onToggle,
}: {
  qa: QA;
  dbName: string;
  onToast: (msg: string, kind?: "ok" | "err") => void;
  open: boolean;
  onToggle: () => void;
}) {
  const me = useMe();
  const sources = useSqlDataSources();
  const preview = useSqlPreview();
  const create = useCreateSqlWidget();

  const [name, setName] = useState(qa.question.slice(0, 80));
  const sourceNames = (sources.data ?? []).map((s) => s.name);
  const [source, setSource] = useState<string | null>(null);
  const selected = source ?? (sourceNames.includes(dbName) ? dbName : sourceNames[0] ?? "");
  const [busy, setBusy] = useState(false);

  if (!me.data?.is_admin || !qa.sql) return null;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !selected || !qa.sql) return;
    setBusy(true);
    try {
      const p = await preview.mutateAsync({
        data_source: selected,
        sql: qa.sql,
        range: "30d",
      });
      if ((p as { error?: string }).error) {
        throw new Error((p as { error?: string }).error);
      }
      await create.mutateAsync({
        name: name.trim(),
        description: qa.question,
        data_source: selected,
        sql: qa.sql,
        viz: (p as PreviewResult).inferred_viz,
        options: {},
      });
      onToast("Added to dashboard widgets", "ok");
      onToggle();
    } catch (err) {
      onToast("Add failed: " + ((err as Error).message ?? "unknown"), "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={onToggle} title="Save as dashboard widget">
        + dashboard
      </button>
      {open && (
        <form className="an-action-pop" onSubmit={add}>
          <span className="an-action-pop__eyebrow">add to dashboard</span>
          <input
            type="text"
            aria-label="Widget name"
            placeholder="widget name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <select
            aria-label="Data source"
            value={selected}
            onChange={(e) => setSource(e.target.value)}
          >
            {sourceNames.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="an-action-pop__row">
            <button type="button" onClick={onToggle}>
              Cancel
            </button>
            <button type="submit" disabled={busy || !name.trim() || !selected}>
              {busy ? "Adding..." : "Add widget"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

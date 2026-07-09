import { useState } from "react";
import type { QA, ResultTab } from "../types";
import type { SavedQueryRequest } from "../../api/llm";
import { toCsv } from "../format";
import PinToDashboard from "./PinToDashboard";

export default function ResultActions({
  qa,
  activeTab,
  dbName,
  onSave,
  onToast,
}: {
  qa: QA;
  activeTab: ResultTab;
  dbName: string;
  onSave: (body: SavedQueryRequest) => Promise<number>;
  onToast: (msg: string, kind?: "ok" | "err") => void;
}) {
  const [panel, setPanel] = useState<"save" | "dashboard" | null>(null);
  const [name, setName] = useState(qa.question.slice(0, 80));
  const [tags, setTags] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  const canCopy = activeTab !== "chart";
  const canCsv = qa.data.length > 0;

  async function copy() {
    let text = "";
    if (activeTab === "sql") text = qa.sql ?? "";
    else if (activeTab === "json") text = JSON.stringify(qa.data, null, 2);
    else if (activeTab === "table") {
      const cols = Array.from(
        qa.data.reduce<Set<string>>((s, r) => {
          for (const k of Object.keys(r)) s.add(k);
          return s;
        }, new Set()),
      );
      const header = cols.join("\t");
      const body = qa.data
        .map((r) => cols.map((c) => String(r[c] ?? "")).join("\t"))
        .join("\n");
      text = `${header}\n${body}`;
    }
    try {
      await navigator.clipboard.writeText(text);
      onToast("Copied", "ok");
    } catch (e) {
      onToast("Copy failed: " + ((e as Error).message ?? "unknown"), "err");
    }
  }

  function download() {
    const csv = toCsv(qa.data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dbName}-${qa.query_id ?? new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !qa.sql) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        sql_query: qa.sql,
        question: qa.question,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        is_public: isPublic,
      });
      onToast("Saved", "ok");
      setPanel(null);
    } catch (err) {
      onToast("Save failed: " + ((err as Error).message ?? "unknown"), "err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPanel((p) => (p === "save" ? null : "save"))}
        disabled={!qa.sql}
        title={qa.sql ? "Save to your query list" : "No SQL to save"}
      >
        ★ save
      </button>
      <button type="button" onClick={copy} disabled={!canCopy}>
        copy
      </button>
      <button type="button" onClick={download} disabled={!canCsv}>
        ⬇ csv
      </button>
      <PinToDashboard
        qa={qa}
        dbName={dbName}
        onToast={onToast}
        open={panel === "dashboard"}
        onToggle={() => setPanel((p) => (p === "dashboard" ? null : "dashboard"))}
      />
      {panel === "save" && (
        <form className="an-action-pop" onSubmit={save}>
          <span className="an-action-pop__eyebrow">save query</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="name"
            aria-label="Query name"
            required
          />
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="tags (comma separated)"
            aria-label="Tags"
          />
          <label className="an-save-form__row">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            visible to everyone
          </label>
          <div className="an-action-pop__row">
            <button type="button" onClick={() => setPanel(null)}>
              Cancel
            </button>
            <button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Saving..." : "Save query"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

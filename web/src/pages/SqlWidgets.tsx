import { useState } from "react";
import {
  useSqlWidgets, useSqlDataSources, useSqlPreview,
  useCreateSqlWidget, useUpdateSqlWidget, useDeleteSqlWidget,
} from "../api/sqlWidgets";
import type { SqlWidget, PreviewResult, SqlVizKind } from "../api/sqlWidgets";
import ConfirmDialog from "../ui/ConfirmDialog";

export default function SqlWidgets() {
  const list = useSqlWidgets();
  const del = useDeleteSqlWidget();
  const [editing, setEditing] = useState<SqlWidget | "new" | null>(null);
  const [deleting, setDeleting] = useState<SqlWidget | null>(null);
  const widgets = list.data ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <span className="eyebrow">admin · sql widgets</span>
          <h1 style={{ marginTop: 6 }}>Custom SQL widgets</h1>
        </div>
        <button type="button" onClick={() => setEditing("new")}>+ New widget</button>
      </header>

      {widgets.length === 0 ? (
        <div style={{ color: "var(--muted)" }}>No SQL widgets yet.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Data source</th>
              <th style={th}>Viz</th>
              <th style={th}>Updated</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {widgets.map(w => (
              <tr key={w.id}>
                <td style={td}>{w.name}</td>
                <td style={td}>{w.data_source}</td>
                <td style={td}>{w.viz}</td>
                <td style={td}>{new Date(w.updated_at).toLocaleString()}</td>
                <td style={td}>
                  <button type="button" onClick={() => setEditing(w)}>Edit</button>
                  {" "}
                  <button type="button" onClick={() => setDeleting(w)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && <Editor widget={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete SQL widget"
        message={
          deleting
            ? `Delete "${deleting.name}"? Dashboards using it will show a deleted-widget tile.`
            : ""
        }
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (deleting) await del.mutateAsync(deleting.id);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
  return h;
}

function Editor({
  widget, onClose,
}: {
  widget: SqlWidget | "new";
  onClose: () => void;
}) {
  const isNew = widget === "new";
  const initial = isNew
    ? { name: "", description: "", data_source: "", sql: "", viz: "number" as SqlVizKind, options: {} as any }
    : widget;
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [dataSource, setDataSource] = useState(initial.data_source);
  const [sql, setSql] = useState(initial.sql);
  const [viz, setViz] = useState<SqlVizKind>(initial.viz);
  const [options, setOptions] = useState<any>(initial.options ?? {});
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewedHash, setPreviewedHash] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const sources = useSqlDataSources();
  const previewMut = useSqlPreview();
  const createMut = useCreateSqlWidget();
  const updateMut = useUpdateSqlWidget(isNew ? 0 : (widget as SqlWidget).id);

  async function runPreview() {
    setPreviewError(null);
    try {
      const r = await previewMut.mutateAsync({ data_source: dataSource, sql, range: "30d" });
      if ((r as any).error) {
        setPreviewError((r as any).error);
        setPreview(null);
        setPreviewedHash(null);
      } else {
        setPreview(r as PreviewResult);
        setPreviewedHash(hash(sql));
        setViz((r as PreviewResult).inferred_viz);
      }
    } catch (e: any) {
      setPreviewError(e.message || "preview failed");
      setPreviewedHash(null);
      setPreview(null);
    }
  }

  const canSave =
    name.trim() &&
    dataSource &&
    sql.trim() &&
    previewedHash === hash(sql);

  async function save() {
    const body = { name, description, data_source: dataSource, sql, viz, options };
    if (isNew) await createMut.mutateAsync(body);
    else await updateMut.mutateAsync(body);
    onClose();
  }

  return (
    <aside style={drawer}>
      <h3>{isNew ? "New SQL widget" : `Edit: ${(widget as SqlWidget).name}`}</h3>

      <label htmlFor="sw-name">Name</label>
      <input id="sw-name" value={name} onChange={e => setName(e.target.value)} />

      <label htmlFor="sw-desc">Description</label>
      <input id="sw-desc" value={description} onChange={e => setDescription(e.target.value)} />

      <label htmlFor="sw-ds">Data source</label>
      <select id="sw-ds" value={dataSource} onChange={e => setDataSource(e.target.value)}>
        <option value="">—</option>
        {(sources.data ?? []).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
      </select>

      <label htmlFor="sw-sql">SQL</label>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>
        Use <code>:range_days</code> to bind the 7d/30d/90d range picker.
      </div>
      <textarea
        id="sw-sql"
        rows={12}
        style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
        value={sql}
        onChange={e => { setSql(e.target.value); setPreviewedHash(null); }}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={runPreview}
                disabled={!name.trim() || !dataSource || !sql.trim() || previewMut.isPending}>
          {previewMut.isPending ? "Running..." : "Preview"}
        </button>
        <button type="button" onClick={save} disabled={!canSave}>Save</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>

      {previewError && (
        <div role="alert" style={{ color: "var(--bad)" }}>{previewError}</div>
      )}

      {preview && (
        <PreviewArea
          result={preview}
          viz={viz}
          setViz={setViz}
          options={options}
          setOptions={setOptions}
        />
      )}
    </aside>
  );
}

function PreviewArea({
  result, viz, setViz, options, setOptions,
}: {
  result: PreviewResult;
  viz: SqlVizKind;
  setViz: (v: SqlVizKind) => void;
  options: any;
  setOptions: (o: any) => void;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>
        cols: {result.columns.join(", ")} · rows: {result.rows.length}
        {result.truncated ? " (truncated)" : ""} · {result.durationMs}ms
        · inferred: <strong>{result.inferred_viz}</strong>
      </div>

      <label htmlFor="sw-viz">Viz</label>
      <select id="sw-viz" value={viz} onChange={e => setViz(e.target.value as SqlVizKind)}>
        <option value="number">number</option>
        <option value="line">line</option>
        <option value="bar">bar</option>
        <option value="table">table</option>
      </select>

      {(viz === "line" || viz === "bar") && (
        <>
          <label htmlFor="sw-xcol">x column</label>
          <select id="sw-xcol" value={options.xCol ?? result.columns[0] ?? ""}
                  onChange={e => setOptions({ ...options, xCol: e.target.value })}>
            {result.columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <label htmlFor="sw-ycol">y column</label>
          <select id="sw-ycol" value={options.yCol ?? ""}
                  onChange={e => setOptions({ ...options, yCol: e.target.value })}>
            {result.columns.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </>
      )}

      {viz === "number" && (
        <>
          <label htmlFor="sw-unit">Unit</label>
          <input id="sw-unit" value={options.unit ?? ""}
                 onChange={e => setOptions({ ...options, unit: e.target.value })} />
          <label htmlFor="sw-dec">Decimals</label>
          <input id="sw-dec" type="number" value={options.decimals ?? ""}
                 onChange={e => setOptions({ ...options, decimals: e.target.value ? Number(e.target.value) : undefined })} />
        </>
      )}

      <details>
        <summary>preview rows (first 20)</summary>
        <pre style={{ fontSize: 11 }}>{JSON.stringify(result.rows.slice(0, 20), null, 2)}</pre>
      </details>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left", padding: "6px 8px",
  borderBottom: "1px solid var(--rule)", fontWeight: 500,
};
const td: React.CSSProperties = {
  padding: "6px 8px", borderBottom: "1px solid var(--rule-faint, var(--rule))",
};

const drawer: React.CSSProperties = {
  position: "fixed", top: 0, right: 0, bottom: 0, width: 480,
  background: "var(--panel)", borderLeft: "1px solid var(--rule)",
  padding: 24, zIndex: 30, overflowY: "auto",
  display: "flex", flexDirection: "column", gap: 8,
};

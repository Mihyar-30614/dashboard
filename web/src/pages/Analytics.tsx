import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { llm, type QueryResult, type Row } from "../api/llm";
import { useToast } from "../ui/Toast";

type Msg =
  | { id: string; role: "user"; text: string }
  | {
      id: string;
      role: "assistant";
      text: string;
      sql?: string | null;
      data?: Row[];
      count?: number;
      error?: string | null;
      warnings?: string[] | null;
      related?: string[] | null;
      query_id?: number | null;
      feedback?: "up" | "down";
    }
  | { id: string; role: "pending"; question: string };

const DB_KEY = "analytics:db";
const CTX_KEY = "analytics:use_context";

function uid() {
  return "m_" + Math.random().toString(36).slice(2, 9);
}

export default function Analytics() {
  const toast = useToast();
  const [dbs, setDbs] = useState<string[]>([]);
  const [db, setDb] = useState<string>(
    () => window.localStorage.getItem(DB_KEY) ?? "",
  );
  const [useCtx, setUseCtx] = useState<boolean>(
    () => window.localStorage.getItem(CTX_KEY) !== "0",
  );
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [discover, setDiscover] = useState<string[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    llm
      .listDatabases()
      .then((r) => {
        setDbs(r.databases);
        if (!db && r.databases.length) setDb(r.databases[0]);
      })
      .catch((e) => setLoadErr(String(e?.message ?? e)));
  }, []);

  useEffect(() => {
    if (db) window.localStorage.setItem(DB_KEY, db);
  }, [db]);

  useEffect(() => {
    window.localStorage.setItem(CTX_KEY, useCtx ? "1" : "0");
  }, [useCtx]);

  const hydrate = useCallback(async (target: string) => {
    if (!target) return;
    try {
      const [conv, disc] = await Promise.all([
        llm.getConversation(target).catch(() => null),
        llm.discover(target, 8).catch(() => null),
      ]);
      setDiscover(disc?.questions ?? []);
      const next: Msg[] = [];
      for (const turn of conv?.history ?? []) {
        if (turn.question)
          next.push({ id: uid(), role: "user", text: String(turn.question) });
        if (turn.answer)
          next.push({
            id: uid(),
            role: "assistant",
            text: String(turn.answer),
            sql: typeof turn.sql === "string" ? turn.sql : null,
          });
      }
      setMessages(next);
    } catch (e) {
      setLoadErr(String((e as Error).message ?? e));
    }
  }, []);

  useEffect(() => {
    hydrate(db);
  }, [db, hydrate]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  async function send(text: string) {
    if (!db || !text.trim() || sending) return;
    const q = text.trim();
    setInput("");
    const userMsg: Msg = { id: uid(), role: "user", text: q };
    const pendingId = uid();
    setMessages((m) => [
      ...m,
      userMsg,
      { id: pendingId, role: "pending", question: q },
    ]);
    setSending(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const r: QueryResult = await llm.query(db, q, useCtx, ac.signal);
      setMessages((m) =>
        m.map((x) =>
          x.id === pendingId
            ? {
                id: pendingId,
                role: "assistant",
                text: r.answer || (r.error ? "" : "(no answer)"),
                sql: r.sql,
                data: r.data,
                count: r.count,
                error: r.error,
                warnings: r.validation_warnings,
                related: r.related_questions,
                query_id: r.query_id,
              }
            : x,
        ),
      );
    } catch (e) {
      const msg = (e as Error).name === "AbortError"
        ? "Cancelled"
        : String((e as Error).message ?? e);
      setMessages((m) =>
        m.map((x) =>
          x.id === pendingId
            ? { id: pendingId, role: "assistant", text: "", error: msg }
            : x,
        ),
      );
    } finally {
      setSending(false);
    }
  }

  async function clearConv() {
    if (!db) return;
    try {
      await llm.clearConversation(db);
      toast.success("Conversation cleared");
    } catch (e) {
      toast.error("Clear failed: " + ((e as Error).message ?? "unknown"));
    }
    setMessages([]);
  }

  async function feedback(msgId: string, correct: boolean) {
    const m = messages.find((x) => x.id === msgId);
    if (!m || m.role !== "assistant" || !m.query_id || !db) return;
    try {
      await llm.feedback(db, m.query_id, correct);
      setMessages((arr) =>
        arr.map((x) =>
          x.id === msgId && x.role === "assistant"
            ? { ...x, feedback: correct ? "up" : "down" }
            : x,
        ),
      );
    } catch (e) {
      toast.error("Feedback failed: " + ((e as Error).message ?? "unknown"));
    }
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const empty = messages.length === 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
        height: "100%",
      }}
    >
      <header style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
        <div>
          <span className="eyebrow">analytics · ask your db</span>
          <h1 style={{ marginTop: 6 }}>
            <em
              style={{
                fontStyle: "italic",
                color: "var(--accent)",
                fontWeight: 500,
              }}
            >
              Ask
            </em>{" "}
            anything.
          </h1>
        </div>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <label
            className="eyebrow"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            db
            <select
              value={db}
              onChange={(e) => setDb(e.target.value)}
              style={{
                background: "var(--panel)",
                color: "var(--text)",
                border: "1px solid var(--rule)",
                borderRadius: 4,
                padding: "6px 10px",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                letterSpacing: "0.04em",
                textTransform: "none",
              }}
            >
              {dbs.length === 0 && <option value="">(loading…)</option>}
              {dbs.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--muted)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={useCtx}
              onChange={(e) => setUseCtx(e.target.checked)}
            />
            context
          </label>
          <button type="button" onClick={clearConv} disabled={!db}>
            Clear
          </button>
        </div>
      </header>

      {loadErr && (
        <div
          style={{
            padding: "10px 14px",
            border: "1px solid var(--rule)",
            borderRadius: 6,
            color: "var(--danger, #d54a4a)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          API: {loadErr} · is the analytics API running on {llm.baseUrl}?
        </div>
      )}

      <div
        ref={listRef}
        style={{
          flex: 1,
          minHeight: 320,
          overflowY: "auto",
          border: "1px solid var(--rule)",
          borderRadius: 8,
          background: "var(--panel)",
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {empty && (
          <EmptyState
            discover={discover}
            db={db}
            onPick={(q) => send(q)}
          />
        )}
        {messages.map((m) => (
          <MessageRow
            key={m.id}
            msg={m}
            onFeedback={(v) => feedback(m.id, v)}
            onRelated={(q) => send(q)}
          />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "flex-end",
        }}
      >
        <textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder={
            db
              ? "Ask a question about " + db + "…"
              : "Select a database to start"
          }
          disabled={!db}
          style={{
            flex: 1,
            resize: "vertical",
            minHeight: 54,
            maxHeight: 200,
            padding: "10px 12px",
            background: "var(--panel)",
            color: "var(--text)",
            border: "1px solid var(--rule)",
            borderRadius: 6,
            fontFamily: "var(--font-sans, inherit)",
            fontSize: 14,
            lineHeight: 1.4,
          }}
        />
        <button
          type="button"
          onClick={() => send(input)}
          disabled={!db || !input.trim() || sending}
          style={{ minWidth: 88, height: 40 }}
        >
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}

function EmptyState({
  discover,
  db,
  onPick,
}: {
  discover: string[];
  db: string;
  onPick: (q: string) => void;
}) {
  return (
    <div
      style={{
        margin: "auto 0",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        alignItems: "flex-start",
      }}
    >
      <div className="eyebrow">
        {db ? `try a question · ${db}` : "no database selected"}
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {discover.length === 0 && (
          <div
            style={{
              color: "var(--muted)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            Type a natural-language question below.
          </div>
        )}
        {discover.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            style={{
              padding: "8px 12px",
              background: "transparent",
              border: "1px solid var(--rule)",
              borderRadius: 999,
              color: "var(--ink-soft)",
              fontSize: 13,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageRow({
  msg,
  onFeedback,
  onRelated,
}: {
  msg: Msg;
  onFeedback: (v: boolean) => void;
  onRelated: (q: string) => void;
}) {
  if (msg.role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div
          style={{
            maxWidth: "75%",
            padding: "10px 14px",
            borderRadius: 10,
            background:
              "color-mix(in srgb, var(--accent) 14%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent) 30%, var(--rule))",
            fontSize: 14,
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
          }}
        >
          {msg.text}
        </div>
      </div>
    );
  }
  if (msg.role === "pending") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="led led--ok" />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--muted)",
          }}
        >
          thinking…
        </span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {msg.error ? (
        <div
          style={{
            color: "var(--danger, #d54a4a)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          {msg.error}
        </div>
      ) : (
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
          }}
        >
          {msg.text}
        </div>
      )}
      {msg.warnings && msg.warnings.length > 0 && (
        <ul
          style={{
            margin: 0,
            paddingLeft: 16,
            color: "var(--muted)",
            fontSize: 12,
          }}
        >
          {msg.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      {msg.sql && (
        <details>
          <summary
            style={{
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            sql
          </summary>
          <pre
            style={{
              marginTop: 6,
              padding: 10,
              background: "var(--ink-faint, rgba(0,0,0,0.04))",
              border: "1px solid var(--rule)",
              borderRadius: 6,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              overflowX: "auto",
              whiteSpace: "pre",
            }}
          >
            {msg.sql}
          </pre>
        </details>
      )}
      {msg.data && msg.data.length > 0 && (
        <details open={msg.data.length <= 20}>
          <summary
            style={{
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            data · {msg.count ?? msg.data.length} row
            {(msg.count ?? msg.data.length) === 1 ? "" : "s"}
          </summary>
          <ResultTable rows={msg.data} />
        </details>
      )}
      {msg.related && msg.related.length > 0 && (
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}
        >
          {msg.related.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onRelated(q)}
              style={{
                padding: "4px 10px",
                background: "transparent",
                border: "1px solid var(--rule)",
                borderRadius: 999,
                color: "var(--muted)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}
      {msg.query_id ? (
        <div
          style={{
            display: "flex",
            gap: 6,
            marginTop: 2,
            color: "var(--muted)",
          }}
        >
          <FeedbackBtn
            active={msg.feedback === "up"}
            label="👍"
            onClick={() => onFeedback(true)}
          />
          <FeedbackBtn
            active={msg.feedback === "down"}
            label="👎"
            onClick={() => onFeedback(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

function FeedbackBtn({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 28,
        height: 24,
        padding: 0,
        background: active
          ? "color-mix(in srgb, var(--accent) 14%, transparent)"
          : "transparent",
        border: "1px solid var(--rule)",
        borderRadius: 4,
        cursor: "pointer",
        fontSize: 12,
      }}
    >
      {label}
    </button>
  );
}

function ResultTable({ rows }: { rows: Row[] }) {
  const cols = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows.slice(0, 50)) for (const k of Object.keys(r)) set.add(k);
    return Array.from(set);
  }, [rows]);
  const view = rows.slice(0, 200);
  return (
    <div
      style={{
        marginTop: 6,
        maxHeight: 320,
        overflow: "auto",
        border: "1px solid var(--rule)",
        borderRadius: 6,
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
        }}
      >
        <thead>
          <tr>
            {cols.map((c) => (
              <th
                key={c}
                style={{
                  position: "sticky",
                  top: 0,
                  background: "var(--panel)",
                  borderBottom: "1px solid var(--rule)",
                  padding: "6px 10px",
                  textAlign: "left",
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  fontWeight: 500,
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td
                  key={c}
                  style={{
                    padding: "6px 10px",
                    borderBottom: "1px solid var(--rule)",
                    verticalAlign: "top",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxWidth: 320,
                  }}
                >
                  {formatCell(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 200 && (
        <div
          style={{
            padding: "8px 12px",
            color: "var(--muted)",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
          }}
        >
          showing 200 of {rows.length}
        </div>
      )}
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

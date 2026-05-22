import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { llm, type QueryResult, type SavedQuery } from "../api/llm";
import { useToast } from "../ui/Toast";
import "../analytics/analytics.css";
import type { QA, ResultTab } from "../analytics/types";
import { pickTab } from "../analytics/result/pickTab";
import { useDbList } from "../analytics/hooks/useDbList";
import { useConversation } from "../analytics/hooks/useConversation";
import { useSavedQueries } from "../analytics/hooks/useSavedQueries";
import { useSchema } from "../analytics/hooks/useSchema";
import LeftRail from "../analytics/rail/LeftRail";
import RailSection from "../analytics/rail/RailSection";
import HistoryList from "../analytics/rail/HistoryList";
import DiscoverList from "../analytics/rail/DiscoverList";
import SavedList from "../analytics/rail/SavedList";
import SchemaTree from "../analytics/rail/SchemaTree";
import Composer from "../analytics/rail/Composer";
import ResultPane from "../analytics/result/ResultPane";

const DB_KEY = "analytics:db";
const CTX_KEY = "analytics:use_context";
const RAIL_KEY = "analytics:rail_open";
const TAB_KEY = (id: number) => `analytics:active_tab:${id}`;

function uid() {
  return "qa_" + Math.random().toString(36).slice(2, 9);
}

export default function Analytics() {
  const toast = useToast();
  const { dbs, loadErr: dbErr } = useDbList();
  const [db, setDb] = useState<string>(
    () => window.localStorage.getItem(DB_KEY) ?? "",
  );
  const [useCtx, setUseCtx] = useState<boolean>(
    () => window.localStorage.getItem(CTX_KEY) !== "0",
  );
  const conv = useConversation(db);
  const saved = useSavedQueries(db);
  const [schemaEnabled, setSchemaEnabled] = useState(false);
  const schemaQ = useSchema(db, schemaEnabled);

  const [input, setInput] = useState("");
  const [discover, setDiscover] = useState<string[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab | null>(null);
  const [railOpen, setRailOpen] = useState<boolean>(
    () => window.localStorage.getItem(RAIL_KEY) === "1",
  );
  const abortRef = useRef<AbortController | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!db && dbs.length) setDb(dbs[0]);
  }, [db, dbs]);
  useEffect(() => {
    if (db) window.localStorage.setItem(DB_KEY, db);
  }, [db]);
  useEffect(() => {
    window.localStorage.setItem(CTX_KEY, useCtx ? "1" : "0");
  }, [useCtx]);
  useEffect(() => {
    window.localStorage.setItem(RAIL_KEY, railOpen ? "1" : "0");
  }, [railOpen]);

  useEffect(() => {
    if (!db) {
      setDiscover([]);
      return;
    }
    llm
      .discover(db, 6)
      .then((r) =>
        setDiscover(
          (r.questions ?? [])
            .map((q) =>
              typeof q === "string" ? q : (q as { question?: string })?.question ?? "",
            )
            .filter(Boolean),
        ),
      )
      .catch(() => setDiscover([]));
  }, [db]);

  const activeQA = useMemo(
    () => conv.history.find((q) => q.id === activeId) ?? null,
    [conv.history, activeId],
  );
  const isPending = activeId !== null && activeId === pendingId;

  const effectiveTab: ResultTab = useMemo(() => {
    if (activeTab) return activeTab;
    return activeQA?.defaultTab ?? "table";
  }, [activeTab, activeQA]);

  useEffect(() => {
    if (!activeQA?.query_id) return;
    const stored = window.localStorage.getItem(TAB_KEY(activeQA.query_id));
    if (stored && ["chart", "table", "sql", "json"].includes(stored)) {
      setActiveTab(stored as ResultTab);
    } else {
      setActiveTab(null);
    }
  }, [activeQA?.query_id]);

  function changeTab(t: ResultTab) {
    setActiveTab(t);
    if (activeQA?.query_id) {
      window.localStorage.setItem(TAB_KEY(activeQA.query_id), t);
    }
  }

  const send = useCallback(
    async (text: string) => {
      if (!db || !text.trim()) return;
      const q = text.trim();
      setInput("");
      const id = uid();
      const draft: QA = {
        id,
        question: q,
        answer: "",
        sql: null,
        data: [],
        count: 0,
        warnings: null,
        related: null,
        query_id: null,
        defaultTab: "table",
      };
      conv.setHistory((h) => [...h, draft]);
      setPendingId(id);
      setActiveId(id);
      setActiveTab(null);
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const r: QueryResult = await llm.query(db, q, useCtx, ac.signal);
        conv.setHistory((h) =>
          h.map((qa) =>
            qa.id === id
              ? {
                  ...qa,
                  answer: r.answer || "",
                  sql: r.sql ?? null,
                  data: r.data ?? [],
                  count: r.count ?? 0,
                  warnings: r.validation_warnings ?? null,
                  related: r.related_questions ?? null,
                  query_id: r.query_id ?? null,
                  error: r.error ?? null,
                  defaultTab: pickTab(r.data ?? []),
                }
              : qa,
          ),
        );
      } catch (e) {
        const msg =
          (e as Error).name === "AbortError"
            ? "Cancelled"
            : String((e as Error)?.message ?? e);
        conv.setHistory((h) =>
          h.map((qa) => (qa.id === id ? { ...qa, error: msg } : qa)),
        );
      } finally {
        setPendingId(null);
      }
    },
    [db, useCtx, conv],
  );

  const executeSaved = useCallback(
    async (sq: SavedQuery) => {
      if (!db) return;
      const id = uid();
      const draft: QA = {
        id,
        question: sq.question || sq.name,
        answer: "",
        sql: sq.sql_query,
        data: [],
        count: 0,
        warnings: null,
        related: null,
        query_id: null,
        defaultTab: "table",
      };
      conv.setHistory((h) => [...h, draft]);
      setPendingId(id);
      setActiveId(id);
      setActiveTab(null);
      try {
        const r = await saved.execute(sq.id);
        if (r.error) throw new Error(r.error);
        conv.setHistory((h) =>
          h.map((qa) =>
            qa.id === id
              ? {
                  ...qa,
                  data: r.data,
                  count: r.count,
                  defaultTab: pickTab(r.data),
                }
              : qa,
          ),
        );
      } catch (e) {
        conv.setHistory((h) =>
          h.map((qa) =>
            qa.id === id
              ? { ...qa, error: String((e as Error)?.message ?? e) }
              : qa,
          ),
        );
      } finally {
        setPendingId(null);
      }
    },
    [db, saved, conv],
  );

  async function feedback(correct: boolean) {
    if (!activeQA?.query_id || !db) return;
    try {
      await llm.feedback(db, activeQA.query_id, correct);
      conv.setHistory((h) =>
        h.map((qa) =>
          qa.id === activeQA.id
            ? { ...qa, feedback: correct ? "up" : "down" }
            : qa,
        ),
      );
    } catch (e) {
      toast.error("Feedback failed: " + ((e as Error)?.message ?? "unknown"));
    }
  }

  function insertAtCaret(text: string) {
    const ta = composerRef.current;
    if (!ta) {
      setInput((s) => s + text);
      return;
    }
    const start = ta.selectionStart ?? input.length;
    const end = ta.selectionEnd ?? input.length;
    const next = input.slice(0, start) + text + input.slice(end);
    setInput(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + text.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        composerRef.current?.focus();
      } else if (meta && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setRailOpen((v) => !v);
      } else if (e.key === "Escape") {
        if (abortRef.current && pendingId) {
          abortRef.current.abort();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingId]);

  const loadErr = dbErr || conv.reloadErr || saved.err;

  return (
    <div className="an">
      <header className="an__header">
        <button
          type="button"
          className="an__hamburger"
          onClick={() => setRailOpen((v) => !v)}
          aria-label="Toggle rail"
        >
          ☰
        </button>
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
        <div className="an__header-tools">
          <label className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            db
            <select
              className="an__db-select"
              value={db}
              onChange={(e) => setDb(e.target.value)}
            >
              {dbs.length === 0 && <option value="">(loading…)</option>}
              {dbs.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="an__ctx">
            <input
              type="checkbox"
              checked={useCtx}
              onChange={(e) => setUseCtx(e.target.checked)}
            />
            context
          </label>
          <button
            type="button"
            onClick={() => conv.clear().then(() => toast.success("Conversation cleared"))}
            disabled={!db}
          >
            Clear
          </button>
        </div>
      </header>

      {loadErr && (
        <div className="an-result__error" style={{ gridColumn: "1 / -1" }}>
          API: {loadErr} · is the analytics API running on {llm.baseUrl}?
        </div>
      )}

      <LeftRail
        isOpen={railOpen}
        onClose={() => setRailOpen(false)}
        sections={
          <>
            <RailSection title="history" count={conv.history.length}>
              <HistoryList
                history={conv.history}
                activeId={activeId}
                onPick={(id) => {
                  setActiveId(id);
                  setActiveTab(null);
                }}
              />
            </RailSection>
            <RailSection title="discover">
              <DiscoverList questions={discover} onPick={send} />
            </RailSection>
            <RailSection title="saved" count={saved.saved.length}>
              <SavedList
                saved={saved.saved}
                onPick={executeSaved}
                onDelete={saved.remove}
              />
            </RailSection>
            <RailSection
              title="schema"
              defaultOpen={false}
              onToggle={(open) => open && setSchemaEnabled(true)}
            >
              <SchemaTree
                schema={schemaQ.schema}
                loading={schemaQ.loading}
                err={schemaQ.err}
                onColumnClick={insertAtCaret}
              />
            </RailSection>
          </>
        }
        composer={
          <Composer
            ref={composerRef}
            value={input}
            onChange={setInput}
            onSubmit={() => send(input)}
            disabled={!db}
            sending={pendingId !== null}
            placeholder={
              db ? "Ask a question about " + db + "…" : "Select a database to start"
            }
          />
        }
      />

      <ResultPane
        qa={activeQA}
        pending={isPending}
        activeTab={effectiveTab}
        onTabChange={changeTab}
        onFeedback={feedback}
        onRelated={send}
        onSave={async (body) => {
          const id = await saved.create(body);
          return id;
        }}
        onToast={(msg, kind) => {
          if (kind === "err") toast.error(msg);
          else toast.success(msg);
        }}
        dbName={db}
      />
    </div>
  );
}

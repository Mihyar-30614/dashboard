import { useCallback, useEffect, useRef, useState } from "react";
import { MessagesSquare, Plus, Trash2 } from "lucide-react";
import { llm, type QueryResult, type SavedQuery } from "../api/llm";
import { useToast } from "../ui/Toast";
import "../analytics/analytics.css";
import type { QA, ResultTab } from "../analytics/types";
import { pickTab } from "../analytics/result/pickTab";
import { useDbList } from "../analytics/hooks/useDbList";
import { useDbUsers } from "../analytics/hooks/useDbUsers";
import { useConversation } from "../analytics/hooks/useConversation";
import { useSavedQueries } from "../analytics/hooks/useSavedQueries";
import { useSchema } from "../analytics/hooks/useSchema";
import ScopeBar from "../analytics/ScopeBar";
import LeftRail from "../analytics/rail/LeftRail";
import RailSection from "../analytics/rail/RailSection";
import ConversationList from "../analytics/rail/ConversationList";
import SavedList from "../analytics/rail/SavedList";
import SchemaTree from "../analytics/rail/SchemaTree";
import Thread, { ThreadStart } from "../analytics/thread/Thread";
import Turn from "../analytics/thread/Turn";
import Composer from "../analytics/thread/Composer";
import ConfirmDialog from "../ui/ConfirmDialog";

const DB_KEY = "analytics:db";
const CTX_KEY = "analytics:use_context";
const RAIL_KEY = "analytics:rail_open";
const TAB_KEY = (id: number) => `analytics:active_tab:${id}`;
const TABS: ResultTab[] = ["chart", "table", "sql", "json", "details"];

function uid() {
  return "qa_" + Math.random().toString(36).slice(2, 9);
}

function storedTab(queryId: number | null): ResultTab | null {
  if (queryId == null) return null;
  const v = window.localStorage.getItem(TAB_KEY(queryId));
  return v && (TABS as string[]).includes(v) ? (v as ResultTab) : null;
}

/** The result fields of a Seer answer, merged over a turn. */
function fromResult(qa: QA, r: QueryResult): QA {
  return {
    ...qa,
    answer: r.answer || qa.answer,
    sql: r.sql ?? qa.sql,
    data: r.data ?? [],
    count: r.count ?? 0,
    warnings: r.validation_warnings ?? null,
    caveats: r.caveats ?? null,
    related: r.related_questions ?? null,
    query_id: r.query_id ?? null,
    error: r.error ?? null,
    defaultTab: pickTab(r.data ?? []),
    restored: false,
  };
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
  const users = useDbUsers(db);
  const conv = useConversation(db);
  const saved = useSavedQueries(db);
  const [schemaEnabled, setSchemaEnabled] = useState(false);
  const schemaQ = useSchema(db, schemaEnabled);

  const [input, setInput] = useState("");
  const [discover, setDiscover] = useState<string[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [tabs, setTabs] = useState<Record<string, ResultTab>>({});
  const [confirmClear, setConfirmClear] = useState(false);
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
    if (!db || users.needsChoice) {
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
  }, [db, users.subject, users.needsChoice]);

  function tabFor(qa: QA): ResultTab {
    return tabs[qa.id] ?? storedTab(qa.query_id) ?? qa.defaultTab;
  }

  function changeTab(qa: QA, t: ResultTab) {
    setTabs((m) => ({ ...m, [qa.id]: t }));
    if (qa.query_id != null) {
      window.localStorage.setItem(TAB_KEY(qa.query_id), t);
    }
  }

  const send = useCallback(
    async (text: string) => {
      if (!db || !text.trim() || users.needsChoice || pendingId) return;
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
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const r: QueryResult = await llm.query(db, q, useCtx, ac.signal, conv.threadId);
        conv.refreshThreads();
        conv.setHistory((h) => h.map((qa) => (qa.id === id ? fromResult(qa, r) : qa)));
      } catch (e) {
        const msg =
          (e as Error).name === "AbortError"
            ? "Stopped before an answer came back."
            : String((e as Error)?.message ?? e);
        conv.setHistory((h) =>
          h.map((qa) => (qa.id === id ? { ...qa, error: msg } : qa)),
        );
      } finally {
        setPendingId(null);
        abortRef.current = null;
      }
    },
    [db, useCtx, conv, users.needsChoice, pendingId],
  );

  // Turns restored from the server conversation carry no result rows, so
  // "Run again" re-asks the question (seer's query cache keeps this cheap).
  const rerun = useCallback(
    async (qa: QA) => {
      if (!db || users.needsChoice || pendingId) return;
      setPendingId(qa.id);
      try {
        const r: QueryResult = await llm.query(db, qa.question, useCtx, undefined, conv.threadId);
        conv.setHistory((h) => h.map((x) => (x.id === qa.id ? fromResult(x, r) : x)));
      } catch (e) {
        conv.setHistory((h) =>
          h.map((x) =>
            x.id === qa.id
              ? { ...x, restored: false, error: String((e as Error)?.message ?? e) }
              : x,
          ),
        );
      } finally {
        setPendingId(null);
      }
    },
    [db, useCtx, conv, users.needsChoice, pendingId],
  );

  const executeSaved = useCallback(
    async (sq: SavedQuery) => {
      if (!db || users.needsChoice || pendingId) return;
      setRailOpen(false);
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
    [db, saved, conv, users.needsChoice, pendingId],
  );

  async function feedback(qa: QA, correct: boolean) {
    if (!qa.query_id || !db) return;
    try {
      await llm.feedback(db, qa.query_id, correct);
      conv.setHistory((h) =>
        h.map((x) => (x.id === qa.id ? { ...x, feedback: correct ? "up" : "down" } : x)),
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

  function stop() {
    abortRef.current?.abort();
  }

  function startThread(id?: string) {
    if (id) conv.switchThread(id);
    else conv.newThread();
    setRailOpen(false);
    requestAnimationFrame(() => composerRef.current?.focus());
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
        abortRef.current?.abort();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const loadErr = dbErr || users.err || conv.reloadErr || saved.err;
  const ready = !!db && !users.loading && !users.needsChoice;
  const blocker = !db
    ? "Pick a database to start."
    : users.needsChoice
      ? `${db} keeps rows per user. Choose whose rows to read in the Rows of picker above.`
      : null;
  const thread = conv.threads.find((t) => t.conversation_id === conv.threadId);

  return (
    <div className="an">
      <header className="an__header">
        <button
          type="button"
          className="an__hamburger"
          onClick={() => setRailOpen((v) => !v)}
          aria-label="Show conversations"
        >
          <MessagesSquare size={16} strokeWidth={1.8} />
        </button>
        <h2 className="an__title">Ask DB</h2>
        <ScopeBar
          db={db}
          dbs={dbs}
          onDb={setDb}
          users={users.info}
          subject={users.subject}
          onSubject={(v) => {
            users.setSubject(v);
            // Follow-ups must not reach back into another user's answers.
            conv.newThread();
          }}
          useCtx={useCtx}
          onUseCtx={setUseCtx}
        />
      </header>

      <LeftRail
        isOpen={railOpen}
        onClose={() => setRailOpen(false)}
        top={
          <button
            type="button"
            className="an-rail__new"
            onClick={() => startThread()}
            disabled={!db || conv.history.length === 0}
            title="Start a new conversation (follow-ups won't see this one)"
          >
            <Plus size={14} strokeWidth={2} /> New conversation
          </button>
        }
        sections={
          <>
            <RailSection title="Conversations" count={conv.threads.length}>
              <ConversationList
                threadId={conv.threadId}
                threads={conv.threads}
                onSwitch={(id) => startThread(id)}
              />
            </RailSection>
            <RailSection title="Saved" count={saved.saved.length}>
              <SavedList
                saved={saved.saved}
                onPick={executeSaved}
                onDelete={saved.remove}
              />
            </RailSection>
            <RailSection
              title="Schema"
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
      />

      <section className="an-main" aria-label="Conversation">
        <div className="an-main__head">
          <span className="an-main__title" title={thread?.title}>
            {thread?.title || "New conversation"}
          </span>
          {conv.history.length > 0 && (
            <span className="an-main__meta">
              {conv.history.length} {conv.history.length === 1 ? "question" : "questions"}
            </span>
          )}
          <button
            type="button"
            className="an-btn an-main__clear"
            onClick={() => setConfirmClear(true)}
            disabled={!db || conv.history.length === 0}
            title="Delete every question in this conversation"
          >
            <Trash2 size={13} strokeWidth={1.8} /> Clear
          </button>
        </div>

        {loadErr && (
          <div className="an-result__error an-main__banner" role="alert">
            Analytics API: {loadErr}. Is it running on {llm.baseUrl}?
          </div>
        )}

        <Thread
          history={conv.history}
          empty={
            <ThreadStart
              db={db}
              blocker={blocker}
              suggestions={discover}
              onPick={send}
            />
          }
          renderTurn={(qa, isLast) => (
            <Turn
              qa={qa}
              pending={qa.id === pendingId}
              activeTab={tabFor(qa)}
              onTabChange={(t) => changeTab(qa, t)}
              onFeedback={(ok) => feedback(qa, ok)}
              onRelated={send}
              onRerun={() => rerun(qa)}
              onSave={(body) => saved.create(body)}
              onToast={(msg, kind) => {
                if (kind === "err") toast.error(msg);
                else toast.success(msg);
              }}
              dbName={db}
              isLast={isLast}
            />
          )}
        />

        <Composer
          ref={composerRef}
          value={input}
          onChange={setInput}
          onSubmit={() => send(input)}
          onStop={stop}
          disabled={!ready}
          sending={pendingId !== null}
          placeholder={
            blocker
              ? blocker
              : conv.history.length > 0 && useCtx
                ? "Ask a follow-up…"
                : `Ask a question about ${db}…`
          }
        />
      </section>

      <ConfirmDialog
        open={confirmClear}
        title="Clear conversation"
        message="Delete every question and answer in this conversation? Saved queries stay."
        confirmLabel="Clear"
        danger
        onConfirm={() => {
          setConfirmClear(false);
          conv.clear().then(
            () => toast.success("Conversation cleared"),
            (e) => toast.error("Clear failed: " + ((e as Error)?.message ?? "unknown")),
          );
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}

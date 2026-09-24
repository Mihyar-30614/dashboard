import { useCallback, useEffect, useState } from "react";
import { llm, type ConversationThread, type ConversationTurn } from "../../api/llm";
import type { QA } from "../types";
import { pickTab } from "../result/pickTab";

function uid() {
  return "qa_" + Math.random().toString(36).slice(2, 9);
}

/** A thread id Seer accepts (letters, digits, "-"; at most 64). */
export function newThreadId(): string {
  return "tab-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const storageKey = (db: string) => `seer-thread:${db}`;

/** This tab's thread for ``db``: kept in sessionStorage, so each browser tab
 * follows up in its own thread and a reload resumes it. */
function tabThread(db: string): string {
  try {
    const stored = sessionStorage.getItem(storageKey(db));
    if (stored) return stored;
  } catch {
    /* storage unavailable: fall through to a fresh id */
  }
  const id = newThreadId();
  rememberThread(db, id);
  return id;
}

function rememberThread(db: string, id: string) {
  try {
    sessionStorage.setItem(storageKey(db), id);
  } catch {
    /* storage unavailable: the thread lasts until the page closes */
  }
}

function turnToQA(t: ConversationTurn): QA | null {
  const question = typeof t.question === "string" ? t.question : "";
  if (!question) return null;
  return {
    id: uid(),
    question,
    answer: typeof t.answer === "string" ? t.answer : "",
    sql: typeof t.sql === "string" ? t.sql : null,
    data: [],
    count: 0,
    warnings: null,
    related: null,
    query_id: null,
    defaultTab: pickTab([]),
  };
}

export type UseConversation = {
  history: QA[];
  setHistory: React.Dispatch<React.SetStateAction<QA[]>>;
  /** The thread this tab asks follow-ups in. */
  threadId: string;
  /** The caller's threads on this database, most recently active first. */
  threads: ConversationThread[];
  switchThread: (id: string) => void;
  newThread: () => void;
  refreshThreads: () => void;
  /** Clears the current thread only. */
  clear: () => Promise<void>;
  reloadErr: string | null;
};

export function useConversation(db: string): UseConversation {
  const [history, setHistory] = useState<QA[]>([]);
  const [reloadErr, setReloadErr] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string>("");
  const [threads, setThreads] = useState<ConversationThread[]>([]);

  useEffect(() => {
    setThreadId(db ? tabThread(db) : "");
  }, [db]);

  const refreshThreads = useCallback(() => {
    if (!db) return;
    llm
      .listConversations(db)
      .then((r) => setThreads(r.conversations ?? []))
      .catch(() => setThreads([]));
  }, [db]);

  useEffect(() => {
    if (!db || !threadId) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    llm
      .getConversation(db, threadId)
      .then((r) => {
        if (cancelled) return;
        const next = (r.history ?? [])
          .map(turnToQA)
          .filter((q): q is QA => q !== null);
        setHistory(next);
        setReloadErr(null);
      })
      .catch((e) => {
        if (!cancelled) setReloadErr(String((e as Error)?.message ?? e));
      });
    refreshThreads();
    return () => {
      cancelled = true;
    };
  }, [db, threadId, refreshThreads]);

  const switchThread = useCallback(
    (id: string) => {
      if (!db || !id) return;
      rememberThread(db, id);
      setThreadId(id);
    },
    [db],
  );

  const newThread = useCallback(() => {
    if (!db) return;
    switchThread(newThreadId());
  }, [db, switchThread]);

  const clear = useCallback(async () => {
    if (!db || !threadId) return;
    await llm.clearConversation(db, threadId);
    setHistory([]);
    refreshThreads();
  }, [db, threadId, refreshThreads]);

  return {
    history,
    setHistory,
    threadId,
    threads,
    switchThread,
    newThread,
    refreshThreads,
    clear,
    reloadErr,
  };
}

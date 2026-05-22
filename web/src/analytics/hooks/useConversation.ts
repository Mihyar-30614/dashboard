import { useCallback, useEffect, useState } from "react";
import { llm, type ConversationTurn } from "../../api/llm";
import type { QA } from "../types";
import { pickTab } from "../result/pickTab";

function uid() {
  return "qa_" + Math.random().toString(36).slice(2, 9);
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
  clear: () => Promise<void>;
  reloadErr: string | null;
};

export function useConversation(db: string): UseConversation {
  const [history, setHistory] = useState<QA[]>([]);
  const [reloadErr, setReloadErr] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setHistory([]);
      return;
    }
    let cancelled = false;
    llm
      .getConversation(db)
      .then((r) => {
        if (cancelled) return;
        const next = (r.history ?? [])
          .map(turnToQA)
          .filter((q): q is QA => q !== null);
        setHistory(next);
      })
      .catch((e) => {
        if (!cancelled) setReloadErr(String((e as Error)?.message ?? e));
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const clear = useCallback(async () => {
    if (!db) return;
    await llm.clearConversation(db);
    setHistory([]);
  }, [db]);

  return { history, setHistory, clear, reloadErr };
}

import { useCallback, useEffect, useState } from "react";
import { llm, type SavedQuery, type SavedQueryRequest } from "../../api/llm";

export type UseSavedQueries = {
  saved: SavedQuery[];
  reload: () => Promise<void>;
  create: (body: SavedQueryRequest) => Promise<number>;
  remove: (id: number) => Promise<void>;
  execute: (id: number) => Promise<{ data: Array<Record<string, unknown>>; count: number; error: string | null }>;
  err: string | null;
};

export function useSavedQueries(db: string): UseSavedQueries {
  const [saved, setSaved] = useState<SavedQuery[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!db) {
      setSaved([]);
      return;
    }
    try {
      const r = await llm.savedQueries.list(db);
      setSaved(r.queries ?? []);
      setErr(null);
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    }
  }, [db]);

  useEffect(() => {
    reload();
  }, [reload]);

  const create = useCallback(
    async (body: SavedQueryRequest) => {
      if (!db) throw new Error("no database selected");
      const r = await llm.savedQueries.create(db, body);
      await reload();
      return r.query_id;
    },
    [db, reload],
  );

  const remove = useCallback(
    async (id: number) => {
      if (!db) return;
      await llm.savedQueries.delete(db, id);
      await reload();
    },
    [db, reload],
  );

  const execute = useCallback(
    async (id: number) => {
      if (!db) throw new Error("no database selected");
      const r = await llm.savedQueries.execute(db, id);
      return r.result;
    },
    [db],
  );

  return { saved, reload, create, remove, execute, err };
}

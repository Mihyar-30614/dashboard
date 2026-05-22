import { useEffect, useState } from "react";
import { llm } from "../../api/llm";

export type UseDbList = {
  dbs: string[];
  loadErr: string | null;
};

export function useDbList(): UseDbList {
  const [dbs, setDbs] = useState<string[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    llm
      .listDatabases()
      .then((r) => {
        if (!cancelled) setDbs(r.databases);
      })
      .catch((e) => {
        if (!cancelled) setLoadErr(String((e as Error)?.message ?? e));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { dbs, loadErr };
}

import { useCallback, useEffect, useState } from "react";
import { llm, type SchemaInfo } from "../../api/llm";

export type UseSchema = {
  schema: SchemaInfo | null;
  loading: boolean;
  err: string | null;
  load: () => void;
};

export function useSchema(db: string, enabled: boolean): UseSchema {
  const [schema, setSchema] = useState<SchemaInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const load = useCallback(() => {
    setTrigger((t) => t + 1);
  }, []);

  useEffect(() => {
    setSchema(null);
    setErr(null);
  }, [db]);

  useEffect(() => {
    if (!enabled || !db) return;
    if (schema !== null) return;
    let cancelled = false;
    setLoading(true);
    llm
      .schema(db)
      .then((r) => {
        if (!cancelled) setSchema(r);
      })
      .catch((e) => {
        if (!cancelled) setErr(String((e as Error)?.message ?? e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, db, schema, trigger]);

  return { schema, loading, err, load };
}

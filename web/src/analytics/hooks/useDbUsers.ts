import { useEffect, useState } from "react";
import { llm, setSeerSubject, type DbUsers } from "../../api/llm";

/** "All users" in the picker; only offered when the key may read every row. */
export const ALL_USERS = "all";

const SUBJECT_KEY = (db: string) => `analytics:seer_subject:${db}`;

export type UseDbUsers = {
  info: DbUsers | null;
  loading: boolean;
  err: string | null;
  /** Chosen user id(s) or ALL_USERS; "" until chosen. */
  subject: string;
  setSubject: (value: string) => void;
  /** True when the database keeps rows per user and nobody is chosen yet. */
  needsChoice: boolean;
};

/**
 * The users of `db` whose rows answers read, and the one picked for it.
 * The pick is remembered per database and sent with every Seer request
 * (X-Seer-Subject) while this database is selected.
 */
export function useDbUsers(db: string): UseDbUsers {
  const [info, setInfo] = useState<DbUsers | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [subject, setSubjectState] = useState("");

  useEffect(() => {
    setInfo(null);
    setErr(null);
    setSubjectState("");
    setSeerSubject(null);
    if (!db) return;
    let cancelled = false;
    setLoading(true);
    llm
      .listUsers(db)
      .then((r) => {
        if (cancelled) return;
        setInfo(r);
        const saved = window.localStorage.getItem(SUBJECT_KEY(db)) ?? "";
        const valid =
          r.per_user_rows &&
          ((saved === ALL_USERS && r.can_read_all) || r.users.some((u) => u.id === saved));
        const pick = valid ? saved : "";
        setSubjectState(pick);
        setSeerSubject(pick || null);
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
  }, [db]);

  const setSubject = (value: string) => {
    setSubjectState(value);
    setSeerSubject(value || null);
    if (db) window.localStorage.setItem(SUBJECT_KEY(db), value);
  };

  return {
    info,
    loading,
    err,
    subject,
    setSubject,
    needsChoice: !!info?.per_user_rows && !subject,
  };
}

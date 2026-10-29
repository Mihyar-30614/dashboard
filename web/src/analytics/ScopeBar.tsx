import type { DbUsers } from "../api/llm";
import { ALL_USERS } from "./hooks/useDbUsers";

/** Which database, whose rows, and whether follow-ups see earlier turns. */
export default function ScopeBar({
  db,
  dbs,
  onDb,
  users,
  subject,
  onSubject,
  useCtx,
  onUseCtx,
}: {
  db: string;
  dbs: string[];
  onDb: (db: string) => void;
  users: DbUsers | null;
  subject: string;
  onSubject: (id: string) => void;
  useCtx: boolean;
  onUseCtx: (on: boolean) => void;
}) {
  const needsUser = !!users?.per_user_rows && !subject;
  return (
    <div className="an-scope">
      <label className="an-scope__field">
        <span className="an-scope__key">DB</span>
        <select value={db} onChange={(e) => onDb(e.target.value)} aria-label="Database">
          {dbs.length === 0 && <option value="">loading…</option>}
          {dbs.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>

      {users?.per_user_rows && (
        <label
          className={"an-scope__field an-scope__field--user" + (needsUser ? " is-needed" : "")}
          title={`${db} keeps rows per user (${users.owner_table}); answers only read the chosen user's rows`}
        >
          <span className="an-scope__key">Rows of</span>
          <select
            value={subject}
            onChange={(e) => onSubject(e.target.value)}
            aria-label="Whose rows to read"
          >
            <option value="" disabled>
              choose a user…
            </option>
            {users.users.map((u) => (
              <option key={u.id} value={u.id} title={u.id}>
                {u.label || u.id}
              </option>
            ))}
            {users.can_read_all && <option value={ALL_USERS}>All users</option>}
          </select>
        </label>
      )}

      <label
        className="an-scope__toggle"
        title="Answer with the earlier turns of this conversation as context"
      >
        <input type="checkbox" checked={useCtx} onChange={(e) => onUseCtx(e.target.checked)} />
        Follow-ups
      </label>
    </div>
  );
}

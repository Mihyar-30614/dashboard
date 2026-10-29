import type { ConversationThread } from "../../api/llm";
import { ago } from "../../widgets/parts";

/** The caller's threads on this database; the current one is marked. A
 * thread with no turns yet is not listed by Seer, so it is shown on top. */
export default function ConversationList({
  threadId,
  threads,
  onSwitch,
}: {
  threadId: string;
  threads: ConversationThread[];
  onSwitch: (id: string) => void;
}) {
  const listed = threads.some((t) => t.conversation_id === threadId);
  return (
    <>
      {!listed && (
        <div className="an-rail__item is-active" aria-current="true">
          <span className="an-rail__dot" />
          <span className="an-rail__label">New conversation</span>
        </div>
      )}
      {threads.map((t) => {
        const active = t.conversation_id === threadId;
        return (
          <button
            key={t.conversation_id}
            type="button"
            className={"an-rail__item" + (active ? " is-active" : "")}
            aria-current={active ? "true" : undefined}
            onClick={() => onSwitch(t.conversation_id)}
            title={t.title}
          >
            {active && <span className="an-rail__dot" />}
            <span className="an-rail__label">{t.title || "Untitled"}</span>
            <span className="an-rail__meta">
              {t.turns} · {ago(t.last_at)}
            </span>
          </button>
        );
      })}
    </>
  );
}

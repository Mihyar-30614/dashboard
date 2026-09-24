import type { ConversationThread } from "../../api/llm";

const TITLE_CHARS = 48;

function label(t: ConversationThread): string {
  const title = t.title.length > TITLE_CHARS ? t.title.slice(0, TITLE_CHARS - 1) + "…" : t.title;
  return `${title} (${t.turns})`;
}

/** Pick the conversation thread to follow up in, or start a new one. */
export default function ThreadPicker({
  threadId,
  threads,
  onSwitch,
  onNew,
  disabled,
}: {
  threadId: string;
  threads: ConversationThread[];
  onSwitch: (id: string) => void;
  onNew: () => void;
  disabled?: boolean;
}) {
  const current = threads.some((t) => t.conversation_id === threadId);
  return (
    <span className="an__thread">
      <select
        className="an__db-select"
        aria-label="Conversation"
        value={threadId}
        disabled={disabled}
        onChange={(e) => onSwitch(e.target.value)}
      >
        {!current && <option value={threadId}>New conversation</option>}
        {threads.map((t) => (
          <option key={t.conversation_id} value={t.conversation_id}>
            {label(t)}
          </option>
        ))}
      </select>
      <button type="button" onClick={onNew} disabled={disabled} title="Start a new conversation">
        New
      </button>
    </span>
  );
}

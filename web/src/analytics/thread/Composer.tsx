import { forwardRef, useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { ArrowUp, Square } from "lucide-react";

export type ComposerProps = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  /** Cancels the question in flight. */
  onStop?: () => void;
  disabled?: boolean;
  placeholder?: string;
  sending?: boolean;
};

const MAX_HEIGHT = 200;

const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  { value, onChange, onSubmit, onStop, disabled, placeholder, sending },
  ref,
) {
  const inner = useRef<HTMLTextAreaElement | null>(null);

  // Grow with the question up to MAX_HEIGHT, then scroll.
  useLayoutEffect(() => {
    const ta = inner.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, MAX_HEIGHT) + "px";
  }, [value]);

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!sending) onSubmit();
    }
  };

  return (
    <div className="an-composer">
      <div className={"an-composer__box" + (disabled ? " is-disabled" : "")}>
        <textarea
          ref={(el) => {
            inner.current = el;
            if (typeof ref === "function") ref(el);
            else if (ref) ref.current = el;
          }}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          placeholder={placeholder ?? "Ask a question…"}
          disabled={disabled}
          aria-label="Question"
        />
        {sending ? (
          <button
            type="button"
            className="an-composer__send is-stop"
            onClick={onStop}
            title="Stop (Esc)"
            aria-label="Stop"
          >
            <Square size={12} strokeWidth={2.4} fill="currentColor" />
          </button>
        ) : (
          <button
            type="submit"
            className="an-composer__send"
            onClick={onSubmit}
            disabled={disabled || !value.trim()}
            title="Ask (Enter)"
            aria-label="Ask"
          >
            <ArrowUp size={16} strokeWidth={2.2} />
          </button>
        )}
      </div>
      <p className="an-composer__hint">
        <kbd>Enter</kbd> to ask · <kbd>Shift</kbd>+<kbd>Enter</kbd> new line ·{" "}
        <kbd>Ctrl</kbd>+<kbd>K</kbd> focus
      </p>
    </div>
  );
});

export default Composer;

import { forwardRef, type KeyboardEvent } from "react";

export type ComposerProps = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
  sending?: boolean;
};

const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  { value, onChange, onSubmit, disabled, placeholder, sending },
  ref,
) {
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };
  return (
    <div className="an-composer">
      <textarea
        ref={ref}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        placeholder={placeholder ?? "Ask a question…"}
        disabled={disabled}
      />
      <div className="an-composer__row">
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled || !value.trim() || sending}
        >
          {sending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
});

export default Composer;

export default function DiscoverList({
  questions,
  onPick,
}: {
  questions: string[];
  onPick: (q: string) => void;
}) {
  if (questions.length === 0) {
    return <div className="an-rail__empty">No suggestions.</div>;
  }
  return (
    <>
      {questions.map((q) => (
        <button
          key={q}
          type="button"
          className="an-rail__item"
          onClick={() => onPick(q)}
          title={q}
        >
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {q}
          </span>
        </button>
      ))}
    </>
  );
}

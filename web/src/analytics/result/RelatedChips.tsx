export default function RelatedChips({
  related,
  onPick,
}: {
  related: string[] | null;
  onPick: (q: string) => void;
}) {
  if (!related || related.length === 0) return null;
  return (
    <div className="an-chips">
      {related.map((q) => (
        <button
          key={q}
          type="button"
          className="an-chip"
          onClick={() => onPick(q)}
        >
          {q}
        </button>
      ))}
    </div>
  );
}

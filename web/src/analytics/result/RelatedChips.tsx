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
      <span className="an-chips__label">Follow up</span>
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

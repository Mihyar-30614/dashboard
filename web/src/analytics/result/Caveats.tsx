/** Limitations Seer reported for an answer (rows cut off, retries, cached
 * answer, a fallback taken while answering). Renders nothing when empty. */
export default function Caveats({ caveats }: { caveats?: string[] | null }) {
  if (!caveats || caveats.length === 0) return null;
  return (
    <ul
      className="an-result__caveats"
      aria-label="Answer caveats"
      style={{ margin: 0, paddingLeft: 16, color: "var(--muted)", fontSize: 12 }}
    >
      {caveats.map((c, i) => (
        <li key={i}>{c}</li>
      ))}
    </ul>
  );
}

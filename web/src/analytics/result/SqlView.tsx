import { highlightSql } from "../format";

export default function SqlView({ sql }: { sql: string | null }) {
  if (!sql) {
    return <div className="an-result__placeholder">(no sql)</div>;
  }
  const parts = highlightSql(sql);
  return (
    <pre className="an-sql">
      {parts.map((p, i) =>
        p.kw ? (
          <span key={i} className="an-sql__kw">
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </pre>
  );
}

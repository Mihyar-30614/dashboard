import type { SqlRunResult } from "../api/sqlWidgets";

export default function SqlNumber({
  result,
  options = {},
}: {
  result: SqlRunResult;
  options?: { unit?: string; decimals?: number };
}) {
  const col = result.columns[0];
  const row = result.rows[0];
  if (!col || !row) {
    return <div className="metric metric--lg">—</div>;
  }
  const raw = row[col];
  const num = typeof raw === "number" ? raw : Number(raw);
  const formatted =
    typeof options.decimals === "number" && Number.isFinite(num)
      ? num.toFixed(options.decimals)
      : String(raw);
  return (
    <div className="metric metric--lg">
      {formatted}{options.unit ?? ""}
    </div>
  );
}

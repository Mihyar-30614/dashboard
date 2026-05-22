type Row = Record<string, unknown>;

export default function JsonView({ rows }: { rows: Row[] }) {
  return <pre className="an-json">{JSON.stringify(rows, null, 2)}</pre>;
}

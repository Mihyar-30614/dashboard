import { Fragment, type ReactNode } from "react";

type Token =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string }
  | { type: "datetime"; value: string }
  | { type: "date"; value: string }
  | { type: "money"; value: string; currency: string };

type PatternType = Exclude<Token["type"], "text">;

const PATTERNS: Array<{
  type: PatternType;
  re: RegExp;
  capture?: number;
  currency?: (m: RegExpExecArray) => string;
}> = [
  { type: "bold", re: /\*\*([^*\n]+)\*\*/g, capture: 1 },
  { type: "italic", re: /(?<!\*)\*(?!\*)([^*\n]+?)\*(?!\*)/g, capture: 1 },
  { type: "code", re: /`([^`\n]+)`/g, capture: 1 },
  {
    type: "datetime",
    re: /\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g,
  },
  { type: "date", re: /\b\d{4}-\d{2}-\d{2}\b/g },
  {
    type: "money",
    re: /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?|\$\s?\d+(?:\.\d+)?/g,
    currency: () => "USD",
  },
  {
    type: "money",
    re: /\b(USD|EUR|GBP|JPY|CAD|AUD|CHF|SAR|AED|JOD)\s?\d[\d,]*(?:\.\d+)?\b/g,
    currency: (m) => m[1],
  },
];

function nextMatch(text: string, from: number) {
  let best: {
    index: number;
    end: number;
    type: PatternType;
    value: string;
    currency?: string;
  } | null = null;
  for (const p of PATTERNS) {
    p.re.lastIndex = from;
    const m = p.re.exec(text);
    if (!m) continue;
    if (best && m.index >= best.index) continue;
    const captured = p.capture != null ? m[p.capture] : m[0];
    best = {
      index: m.index,
      end: m.index + m[0].length,
      type: p.type,
      value: captured,
      currency: p.currency?.(m),
    };
  }
  return best;
}

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const m = nextMatch(text, i);
    if (!m) {
      out.push({ type: "text", value: text.slice(i) });
      break;
    }
    if (m.index > i) out.push({ type: "text", value: text.slice(i, m.index) });
    if (m.type === "money") {
      out.push({ type: "money", value: m.value, currency: m.currency || "USD" });
    } else {
      out.push({ type: m.type, value: m.value } as Token);
    }
    i = m.end;
  }
  return out;
}

function formatDate(raw: string, withTime: boolean): string {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const opts: Intl.DateTimeFormatOptions = withTime
    ? {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }
    : { year: "numeric", month: "short", day: "numeric" };
  return new Intl.DateTimeFormat(undefined, opts).format(d);
}

function parseMoney(raw: string): number | null {
  const digits = raw.replace(/[^\d.-]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(raw: string, currency: string): string {
  const n = parseMoney(raw);
  if (n == null) return raw;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    }).format(n);
  } catch {
    return raw;
  }
}

function renderToken(t: Token, key: number): ReactNode {
  switch (t.type) {
    case "text":
      return <Fragment key={key}>{t.value}</Fragment>;
    case "bold":
      return <strong key={key}>{t.value}</strong>;
    case "italic":
      return <em key={key}>{t.value}</em>;
    case "code":
      return (
        <code key={key} className="an-answer__code">
          {t.value}
        </code>
      );
    case "datetime":
      return (
        <time key={key} dateTime={t.value} title={t.value}>
          {formatDate(t.value, true)}
        </time>
      );
    case "date":
      return (
        <time key={key} dateTime={t.value} title={t.value}>
          {formatDate(t.value, false)}
        </time>
      );
    case "money":
      return (
        <span key={key} title={t.value}>
          {formatMoney(t.value, t.currency)}
        </span>
      );
  }
}

export default function AnswerText({ text }: { text: string }) {
  const tokens = tokenize(text);
  return <>{tokens.map((t, i) => renderToken(t, i))}</>;
}

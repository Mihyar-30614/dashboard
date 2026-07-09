import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";

export default function AcceptInvite() {
  const [sp] = useSearchParams();
  const token = sp.get("token") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.post("/api/auth/accept-invite", { token, email, password });
      nav("/");
    } catch (e) {
      setErr((e as Error).message || "Could not accept invite");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
      }}
    >
      <form
        onSubmit={submit}
        className="panel fade-up"
        style={{ width: "100%", maxWidth: 420, padding: 32 }}
      >
        <div className="eyebrow">invitation · accept</div>
        <h2 style={{ marginTop: 10 }}>
          Join the{" "}
          <em
            style={{
              fontStyle: "italic",
              color: "var(--accent)",
              fontWeight: 500,
            }}
          >
            observatory
          </em>
          .
        </h2>
        <p
          style={{
            margin: "6px 0 8px",
            color: "var(--muted)",
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          Set your credentials. Tokens are single-use.
        </p>

        {!token && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              border: "1px solid var(--warn)",
              borderRadius: "var(--radius)",
              color: "var(--warn)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.06em",
            }}
          >
            Missing token in URL. Use the link from your invite.
          </div>
        )}

        <label htmlFor="ai-email">Email</label>
        <input
          id="ai-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="ai-pwd">Password (min 12)</label>
        <input
          id="ai-pwd"
          type="password"
          autoComplete="new-password"
          minLength={12}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {err && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              border: "1px solid var(--bad)",
              background: "color-mix(in srgb, var(--bad) 8%, transparent)",
              borderRadius: "var(--radius)",
              color: "var(--bad)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !token}
          style={{ marginTop: 22, width: "100%" }}
        >
          {busy ? "Creating…" : "Create account →"}
        </button>

        <p
          style={{
            marginTop: 24,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--muted)",
            textAlign: "center",
          }}
        >
          Single-tenant · session cookie · 30d
        </p>
      </form>
    </div>
  );
}

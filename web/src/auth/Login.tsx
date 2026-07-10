import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const [sp] = useSearchParams();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api.post("/api/auth/login", { email, password });
      nav(sp.get("next") || "/");
    } catch (e: any) {
      setErr(e.status === 401 ? "Invalid credentials" : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        height: "100%",
        display: "grid",
        gridTemplateColumns: "1.1fr 1fr",
      }}
    >
      <div
        style={{
          padding: "64px 64px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          borderRight: "1px solid var(--border)",
        }}
      >
        <div>
          <div className="eyebrow">v0.1 · observatory</div>
          <h1
            style={{
              marginTop: 18,
              fontSize: 64,
              lineHeight: 0.95,
              fontWeight: 400,
              letterSpacing: "-0.025em",
            }}
          >
            Watch the
            <br />
            <em
              style={{
                fontFamily: "var(--font-display)",
                fontStyle: "italic",
                fontWeight: 500,
                color: "var(--accent)",
              }}
            >
              constellation
            </em>
            .
          </h1>
          <p
            style={{
              maxWidth: 420,
              marginTop: 22,
              color: "var(--muted)",
              fontSize: 15,
              lineHeight: 1.55,
            }}
          >
            A small instrument for keeping three applications honest. Pulls
            health, traffic, KPIs, and PM2 state — read-only, behind a single
            login.
          </p>
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--muted)",
            display: "flex",
            gap: 28,
          }}
        >
          <span><span className="led led--ok" style={{ marginRight: 8 }} />sportly</span>
          <span><span className="led led--ok" style={{ marginRight: 8 }} />honeydoeh</span>
          <span><span className="led led--ok" style={{ marginRight: 8 }} />debtmanager</span>
        </div>
      </div>

      <div
        style={{
          padding: "64px 64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <form
          onSubmit={submit}
          style={{ width: "100%", maxWidth: 360 }}
          className="fade-up"
        >
          <div className="eyebrow">Authenticate</div>
          <h2 style={{ marginTop: 12, fontSize: 30 }}>Sign in</h2>

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
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
            disabled={busy}
            style={{ marginTop: 22, width: "100%" }}
          >
            {busy ? "Authenticating…" : "Enter →"}
          </button>

          <p
            style={{
              marginTop: 28,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}
          >
            Single-tenant · session cookie · 30d
          </p>
        </form>
      </div>
    </div>
  );
}

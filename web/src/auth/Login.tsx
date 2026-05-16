import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();
  const [sp] = useSearchParams();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post("/api/auth/login", { email, password });
      nav(sp.get("next") || "/");
    } catch (e: any) {
      setErr(e.status === 401 ? "Invalid credentials" : "Login failed");
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{ maxWidth: 360, margin: "80px auto" }}
      className="panel"
    >
      <h2 style={{ marginTop: 0 }}>Sign in</h2>
      <label>
        Email
        <input value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {err && <div style={{ color: "crimson" }}>{err}</div>}
      <button type="submit">Sign in</button>
    </form>
  );
}

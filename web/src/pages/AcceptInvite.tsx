import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";

export default function AcceptInvite() {
  const [sp] = useSearchParams();
  const token = sp.get("token") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const nav = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post("/api/auth/accept-invite", { token, email, password });
      nav("/");
    } catch (e: any) {
      setErr(e.message);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="panel"
      style={{ maxWidth: 360, margin: "80px auto" }}
    >
      <h2 style={{ marginTop: 0 }}>Accept invite</h2>
      <label>
        Email
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label>
        Password (min 12)
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {err && <div style={{ color: "crimson" }}>{err}</div>}
      <button type="submit">Create account</button>
    </form>
  );
}

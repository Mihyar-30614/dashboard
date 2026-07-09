import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, MailPlus, Trash2 } from "lucide-react";
import { api } from "../api/client";
import { useToast } from "../ui/Toast";
import { useMe } from "../api/hooks";
import ConfirmDialog from "../ui/ConfirmDialog";

type Invite = {
  id: number;
  email: string | null;
  expires_at: string;
  used_at?: string | null;
};

function fmtExpiry(iso: string): { label: string; tone: "ok" | "warn" | "bad" } {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return { label: "expired", tone: "bad" };
  const days = Math.round(ms / 86_400_000);
  if (days <= 1) return { label: "expires today", tone: "warn" };
  if (days <= 3) return { label: `${days}d left`, tone: "warn" };
  return { label: `${days}d left`, tone: "ok" };
}

export default function Settings() {
  const toast = useToast();
  const { data: user } = useMe();
  const qc = useQueryClient();
  const invites = useQuery({
    queryKey: ["invites"],
    queryFn: () => api.get<Invite[]>("/api/invites"),
  });
  const create = useMutation({
    mutationFn: (email: string) =>
      api.post<{ token: string }>("/api/invites", { email }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites"] }),
  });
  const revoke = useMutation({
    mutationFn: (id: number) => api.del(`/api/invites/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites"] }),
  });

  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<number | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await create.mutateAsync(email);
      setToken(r.token);
      setEmail("");
    } catch (err) {
      toast.error("Invite failed: " + ((err as Error).message ?? "unknown"));
    }
  }

  async function copyToken() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Clipboard blocked");
    }
  }

  const list = invites.data ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 760 }}>
      <header>
        <span className="eyebrow">settings · workspace</span>
        <h1 style={{ marginTop: 6 }}>
          <em
            style={{
              fontStyle: "italic",
              color: "var(--accent)",
              fontWeight: 500,
            }}
          >
            Access
          </em>{" "}
          & invites.
        </h1>
        <p
          style={{
            marginTop: 6,
            color: "var(--muted)",
            fontSize: 14,
            lineHeight: 1.55,
            maxWidth: 520,
          }}
        >
          Single-tenant workspace. Invite tokens are single-use and expire — copy
          immediately, share over a secure channel.
        </p>
      </header>

      <section className="panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 14,
          }}
        >
          <div>
            <span className="eyebrow">invites</span>
            <h3 style={{ marginTop: 4, marginBottom: 0 }}>Issue a new invite</h3>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--muted)",
            }}
          >
            {list.length} active
          </span>
        </div>

        <form
          onSubmit={submit}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 10,
            alignItems: "end",
          }}
        >
          <div>
            <label htmlFor="invite-email">Email (optional)</label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="someone@example.com"
            />
          </div>
          <button type="submit" disabled={create.isPending}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <MailPlus size={14} strokeWidth={1.8} />
              {create.isPending ? "Issuing…" : "Create invite"}
            </span>
          </button>
        </form>

        {token && (
          <div
            className="fade-up"
            style={{
              marginTop: 16,
              padding: "12px 14px",
              border: "1px solid color-mix(in srgb, var(--accent) 40%, var(--rule))",
              background: "color-mix(in srgb, var(--accent) 8%, transparent)",
              borderRadius: "var(--radius)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="eyebrow" style={{ fontSize: 9 }}>
                new token · copy now
              </div>
              <code
                style={{
                  display: "block",
                  marginTop: 4,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--text)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {token}
              </code>
            </div>
            <button
              type="button"
              onClick={copyToken}
              title="Copy token"
              aria-label="Copy token"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
              }}
            >
              {copied ? (
                <Check size={14} strokeWidth={2} />
              ) : (
                <Copy size={14} strokeWidth={1.8} />
              )}
              {copied ? "copied" : "copy"}
            </button>
          </div>
        )}
      </section>

      {user?.is_admin && (
        <section className="panel">
          <span className="eyebrow">admin tools</span>
          <div style={{ marginTop: 8 }}>
            <Link to="/settings/sql-widgets">Custom SQL widgets</Link>
          </div>
        </section>
      )}

      <section className="panel">
        <div style={{ marginBottom: 14 }}>
          <span className="eyebrow">pending</span>
          <h3 style={{ marginTop: 4, marginBottom: 0 }}>Active invites</h3>
        </div>

        {invites.isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="skeleton" style={{ height: 38 }} />
            <div className="skeleton" style={{ height: 38 }} />
          </div>
        ) : list.length === 0 ? (
          <div
            style={{
              padding: "18px 0",
              color: "var(--muted)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              letterSpacing: "0.04em",
            }}
          >
            No active invites.
          </div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {list.map((i) => {
              const exp = fmtExpiry(i.expires_at);
              return (
                <li
                  key={i.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "10px 12px",
                    border: "1px solid var(--rule)",
                    borderRadius: "var(--radius)",
                    background: "var(--bg-elev)",
                  }}
                >
                  <span
                    className={`led led--${exp.tone}`}
                    style={{ flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        color: i.email ? "var(--text)" : "var(--muted)",
                        fontStyle: i.email ? "normal" : "italic",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {i.email || "no email"}
                    </div>
                    <div
                      style={{
                        marginTop: 2,
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "var(--muted)",
                      }}
                    >
                      id #{i.id} · {exp.label}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRevoking(i.id)}
                    title="Revoke"
                    aria-label="Revoke invite"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 10px",
                    }}
                  >
                    <Trash2 size={13} strokeWidth={1.8} />
                    revoke
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <ConfirmDialog
        open={revoking !== null}
        title="Revoke invite"
        message="Revoke this invite? The link stops working immediately."
        confirmLabel="Revoke"
        danger
        onConfirm={() => {
          const id = revoking;
          setRevoking(null);
          if (id === null) return;
          revoke
            .mutateAsync(id)
            .catch((e) =>
              toast.error(
                "Revoke failed: " + ((e as Error).message ?? "unknown"),
              ),
            );
        }}
        onCancel={() => setRevoking(null)}
      />
    </div>
  );
}

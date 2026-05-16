import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";

export default function Settings() {
  const qc = useQueryClient();
  const invites = useQuery({
    queryKey: ["invites"],
    queryFn: () => api.get<any[]>("/api/invites"),
  });
  const create = useMutation({
    mutationFn: (email: string) => api.post<any>("/api/invites", { email }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites"] }),
  });
  const [email, setEmail] = useState("");
  const [last, setLast] = useState<string | null>(null);

  return (
    <div className="panel" style={{ maxWidth: 600 }}>
      <h2 style={{ marginTop: 0 }}>Settings</h2>
      <h3>Invites</h3>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await create.mutateAsync(email);
          setLast(r.token);
          setEmail("");
        }}
      >
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email (optional)"
        />
        <button type="submit">Create invite</button>
      </form>
      {last && (
        <div>
          New invite token: <code>{last}</code>
        </div>
      )}
      <ul>
        {invites.data?.map((i) => (
          <li key={i.id}>
            {i.email || "(no email)"} · expires {i.expires_at}
            <button
              onClick={() =>
                api
                  .del(`/api/invites/${i.id}`)
                  .then(() =>
                    qc.invalidateQueries({ queryKey: ["invites"] }),
                  )
              }
            >
              revoke
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

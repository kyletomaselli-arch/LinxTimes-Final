"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteAdmin, setAdminRole, removeAdmin, type SettingsResult } from "./actions";

const init: SettingsResult = { ok: false, message: "" };
const inp = "rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-linx-green focus:ring-2 focus:ring-linx-green/25";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isSelf: boolean;
}

const roleBadge: Record<string, string> = {
  owner: "bg-[#eae4d3] text-[#7d6a2e]",
  manager: "bg-[#e3efe7] text-[#2f6b4c]",
  staff: "bg-[#eef0f3] text-[#5a6069]",
};

export function TeamManager({ members }: { members: TeamMember[] }) {
  const [state, action, pending] = useActionState(inviteAdmin, init);
  const [rowMsg, setRowMsg] = useState<string | null>(null);
  const [rowPending, startTransition] = useTransition();
  const router = useRouter();

  function changeRole(id: string, role: string) {
    const fd = new FormData(); fd.set("id", id); fd.set("role", role);
    startTransition(async () => { const r = await setAdminRole(fd); setRowMsg(r.message); if (r.ok) router.refresh(); });
  }
  function remove(id: string) {
    if (!confirm("Remove this team member's login?")) return;
    const fd = new FormData(); fd.set("id", id);
    startTransition(async () => { const r = await removeAdmin(fd); setRowMsg(r.message); if (r.ok) router.refresh(); });
  }

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)]">
      <h2 className="font-display text-lg font-semibold text-foreground">Team</h2>
      <p className="mt-1 text-sm text-foreground/55">Owners &amp; managers see revenue. Staff logins see the operational tee sheet only — no money.</p>

      <div className="mt-4 divide-y divide-black/5">
        {members.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{m.name} {m.isSelf && <span className="text-xs text-foreground/40">(you)</span>}</div>
              <div className="text-xs text-foreground/45">{m.email}</div>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${roleBadge[m.role] ?? ""}`}>{m.role}</span>
            {!m.isSelf && (
              <>
                <select defaultValue={m.role} onChange={(e) => changeRole(m.id, e.target.value)} disabled={rowPending} className={`${inp} py-1.5 text-xs`}>
                  <option value="owner">Owner</option><option value="manager">Manager</option><option value="staff">Staff</option>
                </select>
                <button onClick={() => remove(m.id)} disabled={rowPending} className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">Remove</button>
              </>
            )}
          </div>
        ))}
      </div>
      {rowMsg && <p className="mt-2 text-xs font-medium text-foreground/60">{rowMsg}</p>}

      <form action={action} className="mt-5 border-t border-black/5 pt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-foreground/45">Add a team member</div>
        <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <input name="name" required placeholder="Name" className={inp} />
          <input name="email" type="email" required placeholder="Email" className={inp} />
          <input name="password" type="text" required placeholder="Temp password" className={inp} />
          <select name="role" defaultValue="staff" className={inp}><option value="staff">Staff</option><option value="manager">Manager</option><option value="owner">Owner</option></select>
        </div>
        {state.message && <p className={`mt-2 text-sm font-medium ${state.ok ? "text-green-700" : "text-red-600"}`}>{state.message}</p>}
        <button disabled={pending} className="mt-3 rounded-full bg-linx-green px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Adding…" : "Add member"}</button>
      </form>
    </div>
  );
}

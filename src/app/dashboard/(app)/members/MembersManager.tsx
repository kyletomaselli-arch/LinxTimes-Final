"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertMember, deleteMember, importMembers, type ImportRow } from "./actions";

export interface MemberRow {
  id: string;
  memberId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  membershipType: string;
  greenFeeOverride: number | null;
  cartIncluded: boolean;
  discountDays: string;
  isActive: boolean;
  notes: string | null;
}

const BLANK: Partial<MemberRow> = {
  membershipType: "full",
  discountDays: "all",
  cartIncluded: false,
  isActive: true,
};

export function MembersManager({ members }: { members: MemberRow[] }) {
  const [editing, setEditing] = useState<Partial<MemberRow> | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await upsertMember(fd);
      setMsg({ ok: res.ok, text: res.message });
      if (res.ok) {
        setEditing(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Remove this member?")) return;
    startTransition(async () => {
      const res = await deleteMember(id);
      setMsg({ ok: res.ok, text: res.message });
      if (res.ok) router.refresh();
    });
  }

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result));
      startTransition(async () => {
        const res = await importMembers(rows);
        setMsg({ ok: res.ok, text: res.message });
        if (res.ok) router.refresh();
        if (fileRef.current) fileRef.current.value = "";
      });
    };
    reader.readAsText(file);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold text-foreground">Members</h1>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" onChange={onImportFile} className="hidden" id="csv" />
          <label htmlFor="csv" className="cursor-pointer rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-foreground/70 transition hover:bg-black/[0.04]">Import CSV</label>
          <a href="/dashboard/members/export" className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-foreground/70 transition hover:bg-black/[0.04]">Export CSV</a>
          <button onClick={() => { setEditing({ ...BLANK }); setMsg(null); }} className="rounded-full bg-course px-4 py-2 text-sm font-semibold text-course-contrast">Add member</button>
        </div>
      </div>

      {msg && (
        <p className={`mt-4 rounded-lg px-3 py-2 text-sm font-medium ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</p>
      )}

      {editing && (
        <form onSubmit={save} className="mt-4 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5 animate-fade-up">
          <input type="hidden" name="id" value={editing.id ?? ""} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <F label="Member ID *"><input name="memberId" required defaultValue={editing.memberId ?? ""} className={inp} /></F>
            <F label="First name *"><input name="firstName" required defaultValue={editing.firstName ?? ""} className={inp} /></F>
            <F label="Last name *"><input name="lastName" required defaultValue={editing.lastName ?? ""} className={inp} /></F>
            <F label="Email"><input name="email" type="email" defaultValue={editing.email ?? ""} className={inp} /></F>
            <F label="Phone"><input name="phone" defaultValue={editing.phone ?? ""} className={inp} /></F>
            <F label="Membership">
              <select name="membershipType" defaultValue={editing.membershipType ?? "full"} className={inp}>
                <option value="full">Full</option><option value="associate">Associate</option>
                <option value="junior">Junior</option><option value="senior">Senior</option><option value="social">Social</option>
              </select>
            </F>
            <F label="Green fee override ($)"><input name="greenFeeOverride" inputMode="decimal" placeholder="blank = course rate" defaultValue={editing.greenFeeOverride != null ? (editing.greenFeeOverride / 100).toFixed(2) : ""} className={inp} /></F>
            <F label="Discount days">
              <select name="discountDays" defaultValue={editing.discountDays ?? "all"} className={inp}>
                <option value="all">All days</option><option value="mon_thu">Mon–Thu only</option>
              </select>
            </F>
            <F label="Notes"><input name="notes" defaultValue={editing.notes ?? ""} className={inp} /></F>
          </div>
          <div className="mt-3 flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="cartIncluded" defaultChecked={editing.cartIncluded ?? false} className="h-4 w-4 accent-[var(--course-primary)]" /> Cart included in membership</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={editing.isActive ?? true} className="h-4 w-4 accent-[var(--course-primary)]" /> Active</label>
          </div>
          <div className="mt-4 flex gap-2">
            <button disabled={pending} className="rounded-full bg-course px-5 py-2 text-sm font-semibold text-course-contrast disabled:opacity-50">{pending ? "Saving…" : "Save member"}</button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-full px-4 py-2 text-sm font-medium text-foreground/60 hover:bg-black/[0.04]">Cancel</button>
          </div>
        </form>
      )}

      <div className="mt-5 overflow-hidden rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)]">
        {members.length === 0 ? (
          <div className="py-16 text-center text-sm text-foreground/50">No members yet. Add one or import a CSV.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs uppercase tracking-wide text-foreground/45">
                <th className="px-4 py-3 font-semibold">Member ID</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Rate</th>
                <th className="px-4 py-3 font-semibold">Cart</th>
                <th className="px-4 py-3 font-semibold">Days</th>
                <th className="px-4 py-3 font-semibold">Active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-black/[0.04] last:border-0 hover:bg-black/[0.015]">
                  <td className="px-4 py-3 font-mono text-xs">{m.memberId}</td>
                  <td className="px-4 py-3"><div className="font-medium">{m.firstName} {m.lastName}</div>{m.email && <div className="text-xs text-foreground/45">{m.email}</div>}</td>
                  <td className="px-4 py-3 capitalize text-foreground/70">{m.membershipType}</td>
                  <td className="px-4 py-3 text-foreground/70">{m.greenFeeOverride != null ? `$${(m.greenFeeOverride / 100).toFixed(0)}` : "Course rate"}</td>
                  <td className="px-4 py-3 text-foreground/70">{m.cartIncluded ? "Included" : "—"}</td>
                  <td className="px-4 py-3 text-foreground/70">{m.discountDays === "mon_thu" ? "Mon–Thu" : "All"}</td>
                  <td className="px-4 py-3">{m.isActive ? <span className="text-green-700">●</span> : <span className="text-foreground/30">●</span>}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => { setEditing(m); setMsg(null); }} className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-foreground/70 transition hover:bg-black/[0.04]">Edit</button>
                    <button onClick={() => remove(m.id)} className="ml-1.5 rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-xs text-foreground/45">CSV columns: memberId, firstName, lastName, email, phone, membershipType, greenFeeOverride, cartIncluded, discountDays</p>
    </div>
  );
}

const inp = "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-course focus:ring-2 focus:ring-course/25";

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">{label}</span>{children}</label>;
}

/** Minimal CSV parser: first row = headers, maps to ImportRow keys. */
function parseCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? "").trim()));
    return row as unknown as ImportRow;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

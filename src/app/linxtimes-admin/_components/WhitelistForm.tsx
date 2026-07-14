"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { whitelistCourse } from "../(app)/actions";

const inp = "rounded-lg border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-linx-green focus:ring-2 focus:ring-linx-green/25";

export function WhitelistForm() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await whitelistCourse(fd);
      setMsg({ ok: res.ok, text: res.message });
      if (res.ok) {
        (e.target as HTMLFormElement).reset();
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-5 shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)]">
      <h2 className="font-display text-lg font-semibold text-foreground">Whitelist a course</h2>
      <p className="mt-1 text-sm text-foreground/55">Pre-approve a course so the owner can onboard by email at /onboard.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block"><span className={lbl}>Course name</span><input name="name" required placeholder="Pebble Creek GC" className={`${inp} w-52`} /></label>
        <label className="block"><span className={lbl}>Owner email</span><input name="email" type="email" required placeholder="owner@course.com" className={`${inp} w-56`} /></label>
        <label className="block"><span className={lbl}>Slug (optional)</span><input name="slug" placeholder="pebble-creek" className={`${inp} w-44`} /></label>
        <button disabled={pending} className="rounded-full bg-linx-green px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Adding…" : "Whitelist"}</button>
      </div>
      {msg && <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
    </form>
  );
}

const lbl = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45";

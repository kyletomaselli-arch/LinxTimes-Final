"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveRequest, declineRequest } from "../(app)/actions";

export function RequestActions({ requestId }: { requestId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function approve() {
    startTransition(async () => {
      const res = await approveRequest(requestId);
      setMsg(res.message);
      if (res.ok) router.refresh();
    });
  }
  function decline() {
    const reason = prompt("Reason for declining (optional):") ?? "";
    const fd = new FormData();
    fd.set("requestId", requestId);
    fd.set("reason", reason);
    startTransition(async () => {
      const res = await declineRequest(fd);
      setMsg(res.message);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-foreground/60">{msg}</span>}
      <button onClick={approve} disabled={pending} className="rounded-full bg-linx-green px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">Approve</button>
      <button onClick={decline} disabled={pending} className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">Decline</button>
    </div>
  );
}

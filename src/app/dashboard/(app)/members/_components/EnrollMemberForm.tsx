"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { enrollNewMember, checkMembershipPaymentStatus } from "../actions";
import { formatCentsCompact } from "@/lib/money";
import type { Course, MembershipTier } from "@/generated/prisma";

const inp = "w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-course focus:ring-2 focus:ring-course/25";

export function EnrollMemberForm({ course, membershipTiers }: { course: Course; membershipTiers: MembershipTier[] }) {
  const [open, setOpen] = useState(false);
  const [tierId, setTierId] = useState(membershipTiers[0]?.id ?? "");
  const [collMethod, setCollMethod] = useState<"terminal" | "cash">("terminal");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"processing" | "success" | "failed">("processing");
  const router = useRouter();

  const selectedTier = membershipTiers.find((t) => t.id === tierId);
  const tierPrice = selectedTier?.priceCents ?? 0;
  const linxFee = Math.min(Math.round(tierPrice * 0.02), 1000); // 2% capped at $10
  const tax = Math.round((tierPrice * course.taxRateBps) / 10000);
  const taxesAndFees = tax + linxFee;
  const total = tierPrice + taxesAndFees;

  // Poll payment status when terminal payment is in progress. "processing" /
  // "failed" are UI placeholders set before the server returns the real
  // payment id — polling with them would hit "Payment not found" and flash a
  // false failure while the charge is still going through.
  useEffect(() => {
    if (!paymentId || paymentId === "processing" || paymentId === "failed") return;

    const poll = async () => {
      const res = await checkMembershipPaymentStatus(paymentId);
      if (res.status === "succeeded") {
        setPaymentStatus("success");
        setTimeout(() => {
          setOpen(false);
          setPaymentId(null);
          router.refresh();
        }, 1500);
      } else if (res.status === "failed") {
        setPaymentStatus("failed");
        setMsg(res.message || "Payment failed. Try again.");
        setPaymentId(null);
      }
    };

    const interval = setInterval(poll, 1000);
    return () => clearInterval(interval);
  }, [paymentId, router]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("tierId", tierId);
    fd.set("method", collMethod);

    // For terminal payments, show processing screen immediately
    if (collMethod === "terminal") {
      setPaymentId("processing");
      setPaymentStatus("processing");
      setMsg(null);
    }

    startTransition(async () => {
      const res = await enrollNewMember(fd);

      if (!res.ok) {
        if (collMethod === "terminal") {
          setPaymentStatus("failed");
          setMsg(res.message);
          setPaymentId("failed");
        } else {
          setMsg(res.message);
        }
        return;
      }

      // If cash, close immediately
      if (collMethod === "cash") {
        setOpen(false);
        router.refresh();
        return;
      }

      // If terminal, update with real payment ID for polling
      if (res.paymentId && res.paymentId !== "processing") {
        setPaymentId(res.paymentId);
        setMsg(res.message || null);
      }
    });
  }

  if (!open) {
    return (
      <div className="mb-6">
        <button onClick={() => { setOpen(true); setMsg(null); setPaymentId(null); }} className="rounded-full bg-course px-4 py-2 text-sm font-semibold text-course-contrast">
          + Enroll new member
        </button>
      </div>
    );
  }

  // Payment processing screen
  if (paymentId) {
    return (
      <div className="mb-6 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-8">
        <div className="text-center">
          {paymentStatus === "processing" && (
            <>
              <div className="mb-4 inline-block">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-foreground/10 border-t-course"></div>
              </div>
              <h2 className="font-display text-lg font-semibold text-foreground">Processing payment</h2>
              <p className="mt-2 text-sm text-foreground/60">Hold the card near the reader</p>
            </>
          )}
          {paymentStatus === "success" && (
            <>
              <div className="mb-4 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h2 className="font-display text-lg font-semibold text-foreground">Payment successful</h2>
              <p className="mt-2 text-sm text-foreground/60">Member enrolled</p>
            </>
          )}
          {paymentStatus === "failed" && (
            <>
              <div className="mb-4 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
              <h2 className="font-display text-lg font-semibold text-foreground">Payment failed</h2>
              {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
              <button
                onClick={() => { setPaymentId(null); setPaymentStatus("processing"); }}
                className="mt-4 rounded-full bg-course px-4 py-2 text-sm font-semibold text-course-contrast"
              >
                Try again
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
      <h2 className="font-display text-lg font-semibold text-foreground">Enroll new member</h2>
      <form onSubmit={submit} className="mt-4 space-y-4" onReset={() => { setOpen(false); setMsg(null); }}>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">First name</span><input name="firstName" required placeholder="John" className={inp} /></label>
          <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Last name</span><input name="lastName" required placeholder="Doe" className={inp} /></label>
          <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Email</span><input name="email" type="email" placeholder="john@example.com" className={inp} /></label>
          <label className="block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Phone</span><input name="phone" placeholder="+1 (555) 123-4567" className={inp} /></label>
        </div>

        <div>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Membership tier</span>
          <select value={tierId} onChange={(e) => setTierId(e.target.value)} className={inp}>
            {membershipTiers.map((t) => (
              <option key={t.id} value={t.id}>{t.name} — ${(t.priceCents / 100).toFixed(2)}</option>
            ))}
          </select>
        </div>

        <div className="rounded-lg bg-black/[0.02] p-3 text-xs space-y-1">
          <div className="flex justify-between"><span>Membership</span><span>{formatCentsCompact(tierPrice)}</span></div>
          {taxesAndFees > 0 && <div className="flex justify-between"><span>Taxes and fees</span><span>{formatCentsCompact(taxesAndFees)}</span></div>}
          <div className="border-t border-black/5 pt-1 flex justify-between font-medium"><span>Total</span><span>{formatCentsCompact(total)}</span></div>
        </div>

        <div className="flex gap-2">
          <label className="flex flex-1 items-center gap-2 rounded-lg border border-black/10 px-2 py-1.5"><input type="radio" name="method" value="terminal" checked={collMethod === "terminal"} onChange={() => setCollMethod("terminal")} /> Card reader</label>
          <label className="flex flex-1 items-center gap-2 rounded-lg border border-black/10 px-2 py-1.5"><input type="radio" name="method" value="cash" checked={collMethod === "cash"} onChange={() => setCollMethod("cash")} /> Cash</label>
        </div>

        {msg && <p className="text-xs font-medium text-red-600">{msg}</p>}
        <div className="flex gap-2">
          <button disabled={pending} className="flex-1 rounded-full bg-course px-3 py-1.5 text-xs font-semibold text-course-contrast disabled:opacity-50">{pending ? "Enrolling…" : "Enroll & charge"}</button>
          <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1.5 text-xs font-medium text-foreground/50 hover:bg-black/[0.04]">Cancel</button>
        </div>
      </form>
    </div>
  );
}

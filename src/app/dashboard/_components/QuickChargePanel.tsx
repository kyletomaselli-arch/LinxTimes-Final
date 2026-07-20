"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { chargeQuick, checkQuickChargeStatus } from "../actions";
import { formatCentsCompact } from "@/lib/money";
import type { ShopItem } from "./TeeSheetClient";

export function QuickChargePanel({ shopItems, taxRateBps }: { shopItems: ShopItem[]; taxRateBps: number }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<"terminal" | "cash">("terminal");
  const [mode, setMode] = useState<"addons" | "custom">("addons");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customAmount, setCustomAmount] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"processing" | "success" | "failed">("processing");
  const router = useRouter();

  // Poll payment status when terminal payment is in progress. "processing" /
  // "failed" are UI placeholders set before the server returns the real
  // payment id — polling with them would hit "Payment not found" and flash a
  // false failure while the charge is still going through.
  useEffect(() => {
    if (!paymentId || paymentId === "processing" || paymentId === "failed") return;

    const poll = async () => {
      const res = await checkQuickChargeStatus(paymentId);
      if (res.status === "succeeded") {
        setPaymentStatus("success");
        setTimeout(() => {
          setOpen(false);
          setPaymentId(null);
          setEmail("");
          setCart({});
          setCustomAmount("");
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

  function calculateTotal() {
    const addonsCents = shopItems.reduce((n, it) => n + it.priceCents * (cart[it.id] ?? 0), 0);
    const customCents = mode === "custom" ? Math.round((Number(customAmount) || 0) * 100) : 0;
    const baseCents = mode === "addons" ? addonsCents : customCents;
    const feeCents = baseCents > 500 ? 50 : 0;
    const taxCents = Math.round((baseCents * taxRateBps) / 10000);
    return { baseCents, feeCents, taxCents, totalCents: baseCents + feeCents + taxCents };
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("email", email);
    fd.set("method", method);
    fd.set("amountCents", String(calculateTotal().baseCents));

    // For terminal payments, show processing screen immediately
    if (method === "terminal") {
      setPaymentId("processing");
      setPaymentStatus("processing");
      setMsg(null);
    }

    startTransition(async () => {
      const res = await chargeQuick(fd);

      if (!res.ok) {
        if (method === "terminal") {
          setPaymentStatus("failed");
          setMsg(res.message);
          setPaymentId("failed");
        } else {
          setMsg(res.message);
        }
        return;
      }

      // If cash, close immediately
      if (method === "cash") {
        setOpen(false);
        setEmail("");
        setCart({});
        setCustomAmount("");
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
      <div className="mb-4">
        <button
          onClick={() => {
            setOpen(true);
            setMsg(null);
            setPaymentId(null);
            setEmail("");
            setCart({});
            setCustomAmount("");
            setMode("addons");
          }}
          className="rounded-full bg-course px-4 py-2 text-sm font-semibold text-course-contrast"
        >
          💳 Quick charge
        </button>
      </div>
    );
  }

  const { baseCents, feeCents, taxCents, totalCents } = calculateTotal();

  // Payment processing screen
  if (paymentId) {
    return (
      <div className="mb-4 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-8">
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
              <p className="mt-2 text-sm text-foreground/60">{formatCentsCompact(totalCents)} charged</p>
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
                onClick={() => {
                  setPaymentId(null);
                  setPaymentStatus("processing");
                }}
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
    <div className="mb-4 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
      <h2 className="font-display text-lg font-semibold text-foreground">Quick charge</h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4" onReset={() => setOpen(false)}>
        {/* Mode selection */}
        <div className="flex gap-2 rounded-lg bg-black/[0.02] p-2">
          <button
            type="button"
            onClick={() => setMode("addons")}
            className={`flex-1 rounded px-3 py-1.5 text-xs font-semibold transition ${mode === "addons" ? "bg-white shadow" : "text-foreground/50"}`}
          >
            Add-ons
          </button>
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`flex-1 rounded px-3 py-1.5 text-xs font-semibold transition ${mode === "custom" ? "bg-white shadow" : "text-foreground/50"}`}
          >
            Custom amount
          </button>
        </div>

        {/* Add-ons list */}
        {mode === "addons" && shopItems.length > 0 && (
          <div className="space-y-2">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Select items</span>
            {shopItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border border-black/10 px-3 py-2">
                <div>
                  <div className="text-xs font-medium">{item.name}</div>
                  <div className="text-[11px] text-foreground/50">{formatCentsCompact(item.priceCents)}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCart((c) => ({ ...c, [item.id]: Math.max(0, (c[item.id] ?? 0) - 1) }))}
                    className="rounded px-1.5 py-0.5 text-xs font-semibold text-foreground/50 hover:bg-black/[0.05]"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-xs font-medium">{cart[item.id] ?? 0}</span>
                  <button
                    type="button"
                    onClick={() => setCart((c) => ({ ...c, [item.id]: (c[item.id] ?? 0) + 1 }))}
                    className="rounded px-1.5 py-0.5 text-xs font-semibold text-foreground/50 hover:bg-black/[0.05]"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Custom amount */}
        {mode === "custom" && (
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Amount ($)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-course focus:ring-2 focus:ring-course/25"
            />
          </label>
        )}

        {/* Email field */}
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-foreground/45">Email (receipt)</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="customer@example.com"
            className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-course focus:ring-2 focus:ring-course/25"
          />
        </label>

        {/* Price breakdown */}
        {baseCents > 0 && (
          <div className="rounded-lg bg-black/[0.02] p-3 text-xs space-y-1">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatCentsCompact(baseCents)}</span></div>
            {feeCents + taxCents > 0 && <div className="flex justify-between"><span>Taxes and fees</span><span>{formatCentsCompact(feeCents + taxCents)}</span></div>}
            <div className="border-t border-black/5 pt-1 flex justify-between font-medium"><span>Total</span><span>{formatCentsCompact(totalCents)}</span></div>
          </div>
        )}

        {/* Payment method */}
        <div className="flex gap-2">
          <label className="flex flex-1 items-center gap-2 rounded-lg border border-black/10 px-2 py-1.5">
            <input type="radio" checked={method === "terminal"} onChange={() => setMethod("terminal")} />
            <span className="text-xs font-medium">Card reader</span>
          </label>
          <label className="flex flex-1 items-center gap-2 rounded-lg border border-black/10 px-2 py-1.5">
            <input type="radio" checked={method === "cash"} onChange={() => setMethod("cash")} />
            <span className="text-xs font-medium">Cash</span>
          </label>
        </div>

        {msg && <p className="text-xs font-medium text-red-600">{msg}</p>}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            disabled={pending || baseCents === 0}
            className="flex-1 rounded-full bg-course px-3 py-1.5 text-xs font-semibold text-course-contrast disabled:opacity-50"
          >
            {pending ? "Processing…" : `Charge ${formatCentsCompact(totalCents)}`}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1.5 text-xs font-medium text-foreground/50 hover:bg-black/[0.04]">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

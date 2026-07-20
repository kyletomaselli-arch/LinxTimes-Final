"use client";

import { useMemo, useState, useEffect } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { formatCentsCompact } from "@/lib/money";
import { formatTimeLabel } from "@/lib/datetime";

export interface PaymentData {
  bookingId: string;
  clientSecret: string;
  publishableKey: string;
  confirmationNo: string;
  totalCents: number;
}

/** What the golfer is paying for — carried over from the selection step so the
 * card form never sits next to a bare dollar amount. */
export interface PaymentSummary {
  layoutName: string;
  dateKey: string;
  slotTime: string;
  numPlayers: number;
  holes: number;
  withCart: boolean;
  quote: {
    greenFeeCents: number;
    cartFeeCents: number;
    discountCents: number;
    promoCode: string | null;
    creditCents: number;
    creditCode: string | null;
    bookingFeeCents: number;
    taxCents: number;
    totalCents: number;
  } | null;
}

// Cache the Stripe.js loader per publishable key (loadStripe should run once).
const stripePromiseCache = new Map<string, Promise<Stripe | null>>();
function getStripePromise(pk: string): Promise<Stripe | null> {
  let p = stripePromiseCache.get(pk);
  if (!p) {
    p = loadStripe(pk);
    stripePromiseCache.set(pk, p);
  }
  return p;
}

export function PaymentStep({
  slug,
  payment,
  onBack,
  summary,
}: {
  slug: string;
  payment: PaymentData;
  onBack: () => void;
  summary?: PaymentSummary;
}) {
  const stripePromise = useMemo(
    () => getStripePromise(payment.publishableKey),
    [payment.publishableKey]
  );

  // Hold the slot for 10 minutes when payment form opens
  useEffect(() => {
    const holdSlot = async () => {
      try {
        await fetch(`/api/courses/${slug}/bookings/${payment.bookingId}/hold`, {
          method: "POST",
        });
      } catch (err) {
        console.error("[PaymentStep] failed to hold slot:", err);
      }
    };
    holdSlot();
  }, [payment.bookingId, slug]);

  return (
    <section className="mt-7 animate-fade-up">
      <div className={`mx-auto ${summary ? "max-w-3xl grid gap-6 md:grid-cols-[minmax(0,300px)_1fr]" : "max-w-lg"}`}>
        {summary && <OrderSummary summary={summary} totalCents={payment.totalCents} />}
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret: payment.clientSecret,
            appearance: {
              theme: "stripe",
              variables: {
                colorPrimary:
                  getComputedStyle(document.documentElement).getPropertyValue(
                    "--course-primary"
                  ) || "#0d3522",
                borderRadius: "12px",
                fontFamily: "var(--font-inter), system-ui, sans-serif",
              },
            },
          }}
        >
          <CheckoutForm slug={slug} payment={payment} onBack={onBack} hasSummary={Boolean(summary)} />
        </Elements>
      </div>
    </section>
  );
}

/** The step-1 summary, carried onto the payment step so the golfer can
 * re-confirm what they're buying while entering card details. */
function OrderSummary({ summary, totalCents }: { summary: PaymentSummary; totalCents: number }) {
  const q = summary.quote;
  return (
    <aside className="h-fit rounded-2xl bg-course/5 p-5 ring-1 ring-course/10">
      <h3 className="font-display text-lg font-semibold text-course">Summary</h3>
      <div className="mt-3 space-y-1.5 text-sm">
        <SumRow label="Course" value={summary.layoutName} />
        <SumRow label="Date" value={summary.dateKey} />
        <SumRow label="Time" value={formatTimeLabel(summary.slotTime)} />
        <SumRow
          label="Players"
          value={`${summary.numPlayers} · ${summary.holes} holes${summary.withCart ? " · cart" : ""}`}
        />
      </div>
      <div className="my-4 h-px bg-course/10" />
      {q ? (
        <div className="space-y-1.5 text-sm">
          <SumRow label="Green fee" value={formatCentsCompact(q.greenFeeCents)} />
          {q.cartFeeCents > 0 && <SumRow label="Cart fee" value={formatCentsCompact(q.cartFeeCents)} />}
          {q.discountCents > 0 && (
            <SumRow label={`Discount${q.promoCode ? ` (${q.promoCode})` : ""}`} value={`−${formatCentsCompact(q.discountCents)}`} />
          )}
          {q.creditCents > 0 && (
            <SumRow label={`Rain check${q.creditCode ? ` (${q.creditCode})` : ""}`} value={`−${formatCentsCompact(q.creditCents)}`} />
          )}
          {q.bookingFeeCents + q.taxCents > 0 && (
            <SumRow label="Taxes & fees" value={formatCentsCompact(q.bookingFeeCents + q.taxCents)} />
          )}
          <div className="my-2 h-px bg-course/10" />
          <SumRow label="Total" value={formatCentsCompact(totalCents)} strong />
        </div>
      ) : (
        <SumRow label="Total" value={formatCentsCompact(totalCents)} strong />
      )}
    </aside>
  );
}

function SumRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={strong ? "font-semibold" : "text-foreground/60"}>{label}</span>
      <span className={strong ? "font-display text-lg font-semibold text-course" : "font-medium"}>{value}</span>
    </div>
  );
}

function CheckoutForm({
  slug,
  payment,
  onBack,
  hasSummary,
}: {
  slug: string;
  payment: PaymentData;
  onBack: () => void;
  hasSummary?: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const returnUrl = `${window.location.origin}/${slug}/confirm/${payment.confirmationNo}`;
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });

    // If we reach here, confirmation failed (otherwise the browser redirected).
    if (stripeError) {
      setError(stripeError.message ?? "Payment could not be completed.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="min-w-0">
      {/* With the summary panel alongside (desktop), this bar is redundant —
          keep it for mobile where the summary sits above the fold. */}
      <div className={`mb-5 flex items-center justify-between rounded-xl bg-course/5 px-4 py-3 ring-1 ring-course/10 ${hasSummary ? "md:hidden" : ""}`}>
        <span className="text-sm font-medium text-foreground/70">Total due</span>
        <span className="font-display text-xl font-semibold text-course">
          {formatCentsCompact(payment.totalCents)}
        </span>
      </div>

      <PaymentElement options={{ layout: "tabs" }} />

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-xs text-foreground/45">
        <LockIcon /> Payments are encrypted and processed securely by Stripe.
      </p>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="rounded-full px-6 py-3 text-sm font-semibold text-foreground/60 transition hover:bg-black/[0.04] disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={!stripe || submitting}
          className="rounded-full bg-course px-7 py-3 text-sm font-semibold text-course-contrast shadow-md transition-all hover:shadow-lg hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Processing…" : `Pay ${formatCentsCompact(payment.totalCents)}`}
        </button>
      </div>
    </form>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 10V8a6 6 0 1 1 12 0v2m-9 0h6a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

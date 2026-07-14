"use client";

import { useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { formatCentsCompact } from "@/lib/money";

export interface PaymentData {
  clientSecret: string;
  publishableKey: string;
  confirmationNo: string;
  totalCents: number;
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
}: {
  slug: string;
  payment: PaymentData;
  onBack: () => void;
}) {
  const stripePromise = useMemo(
    () => getStripePromise(payment.publishableKey),
    [payment.publishableKey]
  );

  return (
    <section className="mt-7 animate-fade-up">
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
        <CheckoutForm slug={slug} payment={payment} onBack={onBack} />
      </Elements>
    </section>
  );
}

function CheckoutForm({
  slug,
  payment,
  onBack,
}: {
  slug: string;
  payment: PaymentData;
  onBack: () => void;
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
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg">
      <div className="mb-5 flex items-center justify-between rounded-xl bg-course/5 px-4 py-3 ring-1 ring-course/10">
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

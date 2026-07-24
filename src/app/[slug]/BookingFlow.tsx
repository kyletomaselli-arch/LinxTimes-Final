"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { formatCentsCompact } from "@/lib/money";
import { formatTimeLabel, addDays, dayOfWeek } from "@/lib/datetime";
import { PaymentStep, type PaymentData } from "./PaymentStep";

interface LayoutOption {
  id: string;
  name: string;
  holes: number;
  cartAvailable: boolean;
}

interface Slot {
  time: string;
  available: boolean;
  blocked: boolean;
  reason?: string;
  maxPlayers: number;
  playersBooked: number;
  spotsLeft: number;
  rateType: "weekday" | "weekend" | "twilight" | "member";
  fromPriceCents: number;
}

interface AvailabilityResult {
  bookable: boolean;
  closedReason?: string;
  slots: Slot[];
}

interface Quote {
  rateType: string;
  perPlayerGreenCents: number;
  greenFeeCents: number;
  cartFeeCents: number;
  bookingFeeCents: number;
  discountCents: number;
  promoCode: string | null;
  creditCents: number;
  creditCode: string | null;
  taxCents: number;
  totalCents: number;
  memberApplied: boolean;
  memberValid: boolean;
  memberCount: number;
  validMemberCount: number;
  validCodes: string[];
  cartAvailable: boolean;
}

type Step = "select" | "payment";

const STEPS: { key: Step; label: string }[] = [
  { key: "select", label: "Tee time & details" },
  { key: "payment", label: "Payment" },
];

export function BookingFlow({
  slug,
  today,
  maxDaysAhead,
  layouts,
}: {
  slug: string;
  today: string;
  maxDaysAhead: number;
  layouts: LayoutOption[];
}) {
  const [step, setStep] = useState<Step>("select");
  const [layoutId, setLayoutId] = useState<string>(layouts[0]?.id ?? "");
  const [date, setDate] = useState<string>(today);
  const [slotTime, setSlotTime] = useState<string>("");

  const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Details
  const [golferName, setGolferName] = useState("");
  const [golferEmail, setGolferEmail] = useState("");
  const [golferPhone, setGolferPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [numPlayers, setNumPlayers] = useState(1);
  const [holes, setHoles] = useState<9 | 18>(18);
  const [withCart, setWithCart] = useState(true); // carts default on (course upsell); golfer can switch to walking
  // One code per member in the group. `appliedCodes` are the codes confirmed via
  // the Check button — only those affect pricing (lookup is submit-based).
  const [memberIds, setMemberIds] = useState<string[]>([""]);
  const [appliedCodes, setAppliedCodes] = useState<string[]>([]);
  const [memberChecked, setMemberChecked] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [waitlistSlot, setWaitlistSlot] = useState<Slot | null>(null);

  const [quote, setQuote] = useState<Quote | null>(null);

  // Booking + payment
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);

  const selectedLayout = layouts.find((l) => l.id === layoutId);
  const cartAvailable = selectedLayout?.cartAvailable ?? false;

  // Day strip: one chip per bookable day (capped at 60 so a 365-day window
  // doesn't render hundreds of chips), annotated closed/full from a single
  // lightweight summary request.
  const dayKeys = Array.from({ length: Math.min(maxDaysAhead, 60) + 1 }, (_, i) => addDays(today, i));
  const [daySummary, setDaySummary] = useState<Map<string, { closed: boolean; full: boolean }>>(new Map());
  useEffect(() => {
    if (!layoutId) return;
    let cancelled = false;
    fetch(`/api/courses/${slug}/days?layoutId=${layoutId}`)
      .then((r) => r.json())
      .then((data: { days?: { date: string; closed: boolean; full: boolean }[] }) => {
        if (cancelled || !Array.isArray(data.days)) return;
        setDaySummary(new Map(data.days.map((d) => [d.date, { closed: d.closed, full: d.full }])));
      })
      .catch(() => {
        // Strip still works without annotations.
      });
    return () => {
      cancelled = true;
    };
  }, [slug, layoutId]);

  // ── Fetch availability when layout/date changes ─────────────────────────────
  useEffect(() => {
    if (!layoutId || !date) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSlotTime("");
    fetch(
      `/api/courses/${slug}/availability?layoutId=${layoutId}&date=${date}`
    )
      .then((r) => r.json())
      .then((data: AvailabilityResult) => {
        if (!cancelled) setAvailability(data);
      })
      .catch(() => {
        if (!cancelled) setAvailability({ bookable: false, slots: [], closedReason: "Could not load tee times" });
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, layoutId, date]);

  // ── Member ID field helpers (submit-based lookup) ────────────────────────────
  const setMemberIdAt = (i: number, v: string) =>
    setMemberIds((ids) => ids.map((x, j) => (j === i ? v : x)));
  const addMemberField = () =>
    setMemberIds((ids) => (ids.length < numPlayers ? [...ids, ""] : ids));
  const removeMemberField = (i: number) =>
    setMemberIds((ids) => (ids.length > 1 ? ids.filter((_, j) => j !== i) : ids));
  // Apply the entered codes → this is what actually prices the booking.
  const applyMemberCodes = () => {
    setAppliedCodes(memberIds.map((c) => c.trim()).filter(Boolean));
    setMemberChecked(true);
  };
  const validCodeSet = new Set(quote?.validCodes ?? []);

  // ── Live pricing quote ──────────────────────────────────────────────────────
  const refreshQuote = useCallback(() => {
    if (!layoutId || !date || !slotTime) {
      setQuote(null);
      return;
    }
    fetch(`/api/courses/${slug}/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        layoutId,
        date,
        slotTime,
        numPlayers,
        holes,
        withCart: withCart && cartAvailable,
        memberIds: appliedCodes,
      }),
    })
      .then((r) => r.json())
      .then((data) => setQuote(data))
      .catch(() => setQuote(null));
  }, [slug, layoutId, date, slotTime, numPlayers, holes, withCart, appliedCodes]);

  // Recompute the live quote as soon as a slot is picked and whenever any
  // pricing input changes (the inline details form is always visible once a
  // slot is selected).
  useEffect(() => {
    if (slotTime) refreshQuote();
  }, [slotTime, refreshQuote]);

  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(golferEmail);
  const canBook =
    !!slotTime && golferName.trim().length > 1 && validEmail && numPlayers >= 1 && agreedToTerms;

  // Tracks how many columns the tee-time grid currently renders (matches the
  // grid-cols-2 / sm:3 / lg:4 classes) so the inline drawer can be inserted
  // directly after the row containing the selected slot.
  const gridCols = useGridCols();

  // Create the booking server-side, then either show Stripe payment or, for
  // pay-at-course, jump straight to the confirmation page.
  const handleBook = useCallback(async () => {
    setBooking(true);
    setBookError(null);
    try {
      const res = await fetch(`/api/courses/${slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          layoutId,
          date,
          slotTime,
          numPlayers,
          holes,
          withCart: withCart && cartAvailable,
          memberIds: appliedCodes,
          agreedToTerms,
          golferName: golferName.trim(),
          golferEmail: golferEmail.trim(),
          golferPhone: golferPhone.trim() || "",
          notes: notes.trim() || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBookError(data.error ?? "Could not complete booking.");
        setBooking(false);
        return;
      }
      // Comp/free member ($0 total): nothing to pay — go straight to the
      // confirmation page.
      if (data.free || (data.confirmationNo && data.totalCents === 0)) {
        window.location.href = `/${slug}/confirm/${data.confirmationNo}`;
        return;
      }
      if (!data.clientSecret) {
        setBookError("Could not start payment. Please try again.");
        setBooking(false);
        return;
      }
      setPaymentData({
        bookingId: data.bookingId,
        clientSecret: data.clientSecret,
        publishableKey: data.publishableKey,
        confirmationNo: data.confirmationNo,
        totalCents: data.totalCents,
      });
      setStep("payment");
      setBooking(false);
    } catch {
      setBookError("Network error. Please try again.");
      setBooking(false);
    }
  }, [
    slug,
    layoutId,
    date,
    slotTime,
    numPlayers,
    holes,
    withCart,
    cartAvailable,
    appliedCodes,
    golferName,
    golferEmail,
    golferPhone,
    notes,
  ]);

  // Inline details drawer — spans the full grid width and is rendered inside
  // the tee-time grid, immediately after the row holding the selected slot, so
  // it opens right under the time the golfer clicked (no scrolling to find it).
  const detailsDrawer = slotTime ? (
    <div
      style={{ gridColumn: "1 / -1" }}
      className="overflow-hidden rounded-2xl border border-course/15 bg-white/70 animate-fade-up"
    >
      <div className="flex items-center justify-between gap-3 border-b border-black/5 bg-course/[0.06] px-5 py-3.5">
        <div className="text-sm font-semibold text-course">
          Complete your booking · {formatTimeLabel(slotTime)}
        </div>
        <button
          onClick={() => setSlotTime("")}
          className="text-xs font-medium text-foreground/50 underline-offset-2 hover:underline"
        >
          Change time
        </button>
      </div>

      <div className="grid gap-7 p-5 sm:p-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full name" value={golferName} onChange={setGolferName} placeholder="Jane Golfer" required />
            <Input label="Email" type="email" value={golferEmail} onChange={setGolferEmail} placeholder="jane@email.com" required />
          </div>
          <Input label="Phone (optional)" value={golferPhone} onChange={setGolferPhone} placeholder="(555) 555-5555" />

          <div>
            <FieldLabel>Special requests (optional)</FieldLabel>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="e.g. celebrating a birthday, need to rent clubs, please pair us up"
              className="mt-2 w-full resize-none rounded-xl border border-black/10 bg-white px-4 py-3 text-base outline-none transition focus:border-course focus:ring-2 focus:ring-course/30"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Players</FieldLabel>
              <div className="mt-2 flex gap-2">
                {(() => {
                  const slot = availability?.slots.find((s) => s.time === slotTime);
                  const maxPlayers = slot?.spotsLeft ?? 4;
                  return [1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      disabled={n > maxPlayers}
                      onClick={() => setNumPlayers(n)}
                      aria-pressed={numPlayers === n}
                      className={`h-11 w-11 rounded-xl text-sm font-semibold transition-all ${
                        numPlayers === n
                          ? "bg-course text-course-contrast shadow-md"
                          : n > maxPlayers
                            ? "bg-black/[0.02] text-foreground/30 cursor-not-allowed"
                            : "bg-black/[0.04] text-foreground/70 hover:bg-black/[0.07]"
                      }`}
                    >
                      {n}
                    </button>
                  ));
                })()}
              </div>
              {(() => {
                const slot = availability?.slots.find((s) => s.time === slotTime);
                if (!slot || slot.spotsLeft >= 4) return null;
                return <p className="mt-2 text-xs text-amber-600 font-medium">Only {slot.spotsLeft} spot{slot.spotsLeft === 1 ? "" : "s"} available</p>;
              })()}
            </div>
            <div>
              <FieldLabel>Holes</FieldLabel>
              <div className="mt-2 flex gap-2">
                {[9, 18].map((h) => (
                  <button
                    key={h}
                    onClick={() => setHoles(h as 9 | 18)}
                    aria-pressed={holes === h}
                    className={`h-11 flex-1 rounded-xl text-sm font-semibold transition-all ${
                      holes === h
                        ? "bg-course text-course-contrast shadow-md"
                        : "bg-black/[0.04] text-foreground/70 hover:bg-black/[0.07]"
                    }`}
                  >
                    {h} holes
                  </button>
                ))}
              </div>
            </div>
          </div>

          {cartAvailable && (
            <div>
              <FieldLabel>Getting around</FieldLabel>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWithCart(true)}
                  aria-pressed={withCart}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3.5 text-sm font-semibold transition ${
                    withCart
                      ? "border-course bg-course/[0.07] text-course ring-1 ring-course/25"
                      : "border-black/10 text-foreground/60 hover:bg-black/[0.02]"
                  }`}
                >
                  <span aria-hidden>🛺</span> Ride (cart)
                </button>
                <button
                  type="button"
                  onClick={() => setWithCart(false)}
                  aria-pressed={!withCart}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3.5 text-sm font-semibold transition ${
                    !withCart
                      ? "border-course bg-course/[0.07] text-course ring-1 ring-course/25"
                      : "border-black/10 text-foreground/60 hover:bg-black/[0.02]"
                  }`}
                >
                  <span aria-hidden>🚶</span> Walking
                </button>
              </div>
            </div>
          )}

          <div>
            <FieldLabel>Member ID, discount, or rain-check code (optional)</FieldLabel>
            <p className="mt-1 text-xs text-foreground/50">
              Enter a member ID for member pricing, a discount code, or a rain-check code — you can combine them.
              Booking for other members? Add each member&apos;s ID; member pricing applies to
              verified members only, everyone else pays the standard rate.
            </p>
            <div className="mt-2 space-y-2">
              {memberIds.map((id, i) => {
                const applied = memberChecked && appliedCodes.includes(id.trim());
                const isValid = applied && validCodeSet.has(id.trim().toLowerCase());
                const isInvalid = applied && id.trim() !== "" && !isValid;
                return (
                  <div key={i}>
                    <div className="flex items-center gap-2">
                      <input
                        value={id}
                        onChange={(e) => setMemberIdAt(i, e.target.value)}
                        placeholder={i === 0 ? "Member ID or discount code" : `Member ${i + 1} ID`}
                        className={`w-full rounded-xl border bg-white px-4 py-3 text-base outline-none transition focus:ring-2 focus:ring-course/30 ${
                          isInvalid ? "border-amber-400" : isValid ? "border-green-500" : "border-black/10 focus:border-course"
                        }`}
                      />
                      {memberIds.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMemberField(i)}
                          aria-label="Remove member"
                          className="shrink-0 rounded-lg px-2 py-2 text-sm text-foreground/40 hover:bg-black/[0.04]"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {isValid && <p className="mt-1 text-xs font-medium text-green-700">✓ Member verified</p>}
                    {isInvalid && <p className="mt-1 text-xs font-medium text-amber-600">Not found — standard rate for this player</p>}
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={applyMemberCodes}
                className="rounded-full bg-course/10 px-4 py-2 text-sm font-semibold text-course transition hover:bg-course/15"
              >
                Apply
              </button>
              {memberIds.length < numPlayers && (
                <button
                  type="button"
                  onClick={addMemberField}
                  className="text-sm font-medium text-course/80 underline-offset-2 hover:underline"
                >
                  + Add another member
                </button>
              )}
            </div>
            {memberChecked && quote && (
              <div className="mt-2 space-y-0.5 text-xs font-medium text-foreground/60">
                <p>
                  {quote.memberCount > 0
                    ? `${quote.memberCount} member${quote.memberCount === 1 ? "" : "s"} applied · ${numPlayers - quote.memberCount} guest${numPlayers - quote.memberCount === 1 ? "" : "s"} at standard rate`
                    : "No members applied"}
                </p>
                {quote.discountCents > 0 && (
                  <p className="text-green-700">Discount {quote.promoCode} applied · −{formatCentsCompact(quote.discountCents)}</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <PriceSummary
            slug={slug}
            layoutName={selectedLayout?.name}
            date={date}
            slotTime={slotTime}
            numPlayers={numPlayers}
            holes={holes}
            quote={quote}
          />
        </div>

        {bookError && (
          <p className="lg:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {bookError}
          </p>
        )}

        <div className="lg:col-span-2 flex items-start gap-3 text-sm text-foreground/70">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            onClick={(e) => setAgreedToTerms(!agreedToTerms)}
            className="mt-0.5 h-5 w-5 cursor-pointer accent-[var(--course-primary)] flex-shrink-0"
          />
          <span className="cursor-pointer" onClick={() => setAgreedToTerms(!agreedToTerms)}>
            I agree to the{" "}
            <a href="/terms" target="_blank" rel="noreferrer" className="font-medium text-course underline underline-offset-2">Terms of Service</a>,{" "}
            <a href="/privacy" target="_blank" rel="noreferrer" className="font-medium text-course underline underline-offset-2">Privacy Policy</a>, and the course&apos;s cancellation policy.
          </span>
        </div>

        <div className="lg:col-span-2 flex justify-end">
          <PrimaryButton disabled={!canBook || booking} onClick={handleBook}>
            {booking ? "Reserving…" : "Continue to payment"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="p-5 sm:p-8">
      <Stepper current={step} />

      {step === "select" && (
        <section className="mt-7 animate-fade-up">
          {layouts.length > 1 && (
            <div className="mb-6">
              <FieldLabel>Choose a course</FieldLabel>
              <div className="mt-2 flex flex-wrap gap-2">
                {layouts.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => {
                      setLayoutId(l.id);
                      setSlotTime("");
                    }}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                      l.id === layoutId
                        ? "bg-course text-course-contrast shadow-md"
                        : "bg-black/[0.04] text-foreground/70 hover:bg-black/[0.07]"
                    }`}
                  >
                    {l.name}
                    <span className="ml-1.5 opacity-60">{l.holes}H</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <FieldLabel>Select a day</FieldLabel>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
              {dayKeys.map((key) => {
                const info = daySummary.get(key);
                const selected = key === date;
                const dow = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][dayOfWeek(key)];
                const dayNum = Number(key.slice(8, 10));
                const monthShort = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][Number(key.slice(5, 7)) - 1];
                return (
                  <button
                    key={key}
                    onClick={() => setDate(key)}
                    aria-pressed={selected}
                    className={`flex w-16 shrink-0 flex-col items-center rounded-xl border py-2.5 transition ${
                      selected
                        ? "border-course bg-course text-course-contrast shadow-md"
                        : info?.closed
                          ? "border-black/5 bg-black/[0.02] text-foreground/35"
                          : "border-black/10 bg-white text-foreground/80 hover:border-course/50 hover:shadow-sm"
                    }`}
                  >
                    <span className={`text-[10px] font-semibold tracking-wide ${selected ? "opacity-85" : "text-foreground/45"}`}>
                      {key === today ? "TODAY" : dow}
                    </span>
                    <span className="text-base font-semibold leading-tight">{dayNum}</span>
                    {info?.closed ? (
                      <span className="text-[9px] font-medium opacity-70">Closed</span>
                    ) : info?.full ? (
                      <span className={`text-[9px] font-semibold ${selected ? "opacity-85" : "text-amber-600"}`}>Full</span>
                    ) : dayNum === 1 || key === dayKeys[0] ? (
                      <span className={`text-[9px] font-medium ${selected ? "opacity-70" : "text-foreground/40"}`}>{monthShort}</span>
                    ) : (
                      <span className="text-[9px] opacity-0">·</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <FieldLabel>Available tee times</FieldLabel>
          <div className="mt-3">
            {loadingSlots ? (
              <SlotSkeleton />
            ) : !availability || availability.slots.length === 0 ? (
              <EmptyState reason={availability?.closedReason} />
            ) : (
              (() => {
                const slots = availability.slots.filter((s) => !s.blocked);
                const selIdx = slots.findIndex((s) => s.time === slotTime);
                // Insert the drawer immediately after the ROW containing the
                // selected slot, so the form opens right under the clicked
                // time — no scrolling to the bottom of the grid.
                const insertAt =
                  selIdx >= 0
                    ? Math.min(
                        slots.length,
                        (Math.floor(selIdx / gridCols) + 1) * gridCols
                      )
                    : -1;
                return (
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                    {slots.map((s, i) => (
                      <Fragment key={s.time}>
                        {insertAt === i && detailsDrawer}
                        <SlotCard
                          slot={s}
                          selected={slotTime === s.time}
                          onSelect={() =>
                            setSlotTime((prev) => (prev === s.time ? "" : s.time))
                          }
                          onWaitlist={() => setWaitlistSlot(s)}
                        />
                      </Fragment>
                    ))}
                    {insertAt === slots.length && detailsDrawer}
                  </div>
                );
              })()
            )}
          </div>
        </section>
      )}

      {step === "payment" && paymentData && (
        <PaymentStep
          slug={slug}
          payment={paymentData}
          onBack={() => setStep("select")}
          summary={{
            layoutName: selectedLayout?.name ?? "",
            dateKey: date,
            slotTime,
            numPlayers,
            holes,
            withCart: withCart && cartAvailable,
            quote,
          }}
        />
      )}

      {waitlistSlot && (
        <WaitlistModal
          slug={slug}
          layoutId={layoutId}
          date={date}
          slot={waitlistSlot}
          onClose={() => setWaitlistSlot(null)}
        />
      )}
    </div>
  );
}

/** Modal to join the waitlist for a full tee time. */
function WaitlistModal({
  slug,
  layoutId,
  date,
  slot,
  onClose,
}: {
  slug: string;
  layoutId: string;
  date: string;
  slot: Slot;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [players, setPlayers] = useState(1);
  const [state, setState] = useState<{ s: "idle" | "sending" | "done" } | { s: "error"; msg: string }>({ s: "idle" });

  async function submit() {
    setState({ s: "sending" });
    try {
      const res = await fetch(`/api/courses/${slug}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layoutId, date, slotTime: slot.time, numPlayers: players, name: name.trim(), email: email.trim(), phone: phone.trim() }),
      });
      if (res.ok) setState({ s: "done" });
      else {
        const d = await res.json().catch(() => ({}));
        setState({ s: "error", msg: d.error ?? "Could not join the waitlist." });
      }
    } catch {
      setState({ s: "error", msg: "Network error. Please try again." });
    }
  }

  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const canSubmit = name.trim().length > 1 && validEmail && state.s !== "sending";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {state.s === "done" ? (
          <div className="text-center">
            <div className="text-2xl">✓</div>
            <h3 className="mt-2 font-display text-lg font-semibold text-foreground">You&apos;re on the waitlist</h3>
            <p className="mt-1 text-sm text-foreground/60">We&apos;ll email you if a spot opens for {formatTimeLabel(slot.time)}.</p>
            <button onClick={onClose} className="mt-5 rounded-full bg-course px-5 py-2.5 text-sm font-semibold text-course-contrast">Done</button>
          </div>
        ) : (
          <>
            <h3 className="font-display text-lg font-semibold text-foreground">Join the waitlist</h3>
            <p className="mt-1 text-sm text-foreground/60">{formatTimeLabel(slot.time)} is full. We&apos;ll email you if a spot frees up.</p>
            <div className="mt-4 space-y-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-sm outline-none focus:border-course focus:ring-2 focus:ring-course/25" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-sm outline-none focus:border-course focus:ring-2 focus:ring-course/25" />
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-sm outline-none focus:border-course focus:ring-2 focus:ring-course/25" />
              <label className="flex items-center justify-between text-sm text-foreground/70">
                Party size
                <select value={players} onChange={(e) => setPlayers(Number(e.target.value))} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm">
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>
            {state.s === "error" && <p className="mt-2 text-sm font-medium text-red-600">{state.msg}</p>}
            <div className="mt-5 flex gap-2">
              <button disabled={!canSubmit} onClick={submit} className="flex-1 rounded-full bg-course px-5 py-2.5 text-sm font-semibold text-course-contrast disabled:opacity-50">{state.s === "sending" ? "Joining…" : "Join waitlist"}</button>
              <button onClick={onClose} className="rounded-full px-4 py-2.5 text-sm font-medium text-foreground/60 hover:bg-black/[0.04]">Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

/**
 * Mirrors the tee-time grid's responsive column count
 * (grid-cols-2 / sm:grid-cols-3 / lg:grid-cols-4) so the inline drawer can be
 * inserted after the exact row containing the selected slot.
 */
function useGridCols(): number {
  const [cols, setCols] = useState(2);
  useEffect(() => {
    const lg = window.matchMedia("(min-width: 1024px)");
    const sm = window.matchMedia("(min-width: 640px)");
    const update = () => setCols(lg.matches ? 4 : sm.matches ? 3 : 2);
    update();
    lg.addEventListener("change", update);
    sm.addEventListener("change", update);
    return () => {
      lg.removeEventListener("change", update);
      sm.removeEventListener("change", update);
    };
  }, []);
  return cols;
}

function Stepper({ current }: { current: Step }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const active = i === currentIdx;
        const done = i < currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                active
                  ? "bg-course text-course-contrast"
                  : done
                    ? "bg-course/15 text-course"
                    : "bg-black/[0.05] text-foreground/40"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  active || done ? "bg-white/25" : "bg-black/10"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-px w-4 sm:w-8 ${done ? "bg-course/40" : "bg-black/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SlotCard({
  slot,
  selected,
  onSelect,
  onWaitlist,
}: {
  slot: Slot;
  selected: boolean;
  onSelect: () => void;
  onWaitlist: () => void;
}) {
  // A "full" slot (booked out, but not closed) is clickable to join the waitlist.
  const isFull = !slot.available && !slot.blocked;
  const disabled = slot.blocked;
  const twilight = slot.rateType === "twilight";
  const lastSpot = !isFull && !disabled && slot.spotsLeft === 1;
  return (
    <button
      disabled={disabled}
      onClick={isFull ? onWaitlist : onSelect}
      className={`group relative flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
        selected
          ? "border-course bg-course text-course-contrast shadow-md"
          : disabled
            ? "cursor-not-allowed border-black/5 bg-black/[0.02] text-foreground/30"
            : isFull
              ? "border-amber-300 bg-amber-50/60 hover:border-amber-400 hover:shadow-sm"
              : twilight
                ? "border-amber-300/60 bg-[#fffdf4] hover:border-course/50 hover:shadow-md hover:-translate-y-0.5"
                : "border-black/10 bg-white hover:border-course/50 hover:shadow-md hover:-translate-y-0.5"
      }`}
    >
      <div className="flex w-full items-center justify-between gap-1.5">
        <span className="text-base font-semibold">{formatTimeLabel(slot.time)}</span>
        {twilight && !disabled ? (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${selected ? "bg-white/20 text-course-contrast" : "bg-[#f7edd2] text-[#8a6d1c]"}`}>
            Twilight
          </span>
        ) : (
          <AvailabilityDot available={slot.available} blocked={slot.blocked} selected={selected} />
        )}
      </div>
      <span
        className={`mt-1 text-xs ${
          selected
            ? "opacity-80"
            : isFull
              ? "font-medium text-amber-700"
              : lastSpot
                ? "font-semibold text-amber-600"
                : "opacity-60"
        }`}
      >
        {disabled
          ? isFull
            ? "Full"
            : ""
          : isFull
            ? "Full · Join waitlist"
            : lastSpot
              ? `1 spot left · ${formatCentsCompact(slot.fromPriceCents)}/player`
              : `${slot.spotsLeft} spots · ${formatCentsCompact(slot.fromPriceCents)}/player`}
      </span>
    </button>
  );
}

function AvailabilityDot({
  available,
  blocked,
  selected,
}: {
  available: boolean;
  blocked: boolean;
  selected: boolean;
}) {
  const color = selected
    ? "bg-white/80"
    : available
      ? "bg-green-500"
      : blocked
        ? "bg-black/20"
        : "bg-amber-400";
  return <span className={`h-2 w-2 rounded-full ${color}`} />;
}

function PriceSummary({
  layoutName,
  date,
  slotTime,
  numPlayers,
  holes,
  quote,
}: {
  slug: string;
  layoutName?: string;
  date: string;
  slotTime: string;
  numPlayers: number;
  holes: number;
  quote: Quote | null;
}) {
  return (
    <aside className="h-fit rounded-2xl bg-course/5 p-5 ring-1 ring-course/10">
      <h3 className="font-display text-lg font-semibold text-course">Summary</h3>
      <div className="mt-3 space-y-1.5 text-sm">
        <SummaryRow label="Course" value={layoutName ?? ""} />
        <SummaryRow label="Date" value={date} />
        <SummaryRow label="Time" value={slotTime ? formatTimeLabel(slotTime) : ""} />
        <SummaryRow label="Players" value={`${numPlayers} · ${holes} holes`} />
      </div>

      <div className="my-4 h-px bg-course/10" />

      {quote ? (
        <div className="space-y-1.5 text-sm">
          <SummaryRow
            label={
              quote.memberApplied
                ? `Green fee (${quote.memberCount} member${quote.memberCount === 1 ? "" : "s"})`
                : numPlayers > 1
                  ? `Green fee (${numPlayers} × ${formatCentsCompact(quote.perPlayerGreenCents)}/player)`
                  : "Green fee"
            }
            value={formatCentsCompact(quote.greenFeeCents)}
          />
          {quote.cartFeeCents > 0 && (
            <SummaryRow label="Cart fee" value={formatCentsCompact(quote.cartFeeCents)} />
          )}
          {quote.discountCents > 0 && (
            <SummaryRow label={`Discount${quote.promoCode ? ` (${quote.promoCode})` : ""}`} value={`−${formatCentsCompact(quote.discountCents)}`} />
          )}
          {quote.creditCents > 0 && (
            <SummaryRow label={`Rain check${quote.creditCode ? ` (${quote.creditCode})` : ""}`} value={`−${formatCentsCompact(quote.creditCents)}`} />
          )}
          {quote.bookingFeeCents + quote.taxCents > 0 && (
            <SummaryRow label="Taxes & fees" value={formatCentsCompact(quote.bookingFeeCents + quote.taxCents)} />
          )}
          <div className="my-2 h-px bg-course/10" />
          <SummaryRow label="Total" value={formatCentsCompact(quote.totalCents)} strong />
        </div>
      ) : (
        <p className="text-sm text-foreground/40">Pricing appears here.</p>
      )}
    </aside>
  );
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? "font-semibold" : "text-foreground/60"}>{label}</span>
      <span className={strong ? "font-display text-lg font-semibold text-course" : "font-medium"}>
        {value}
      </span>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
      {children}
    </label>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <FieldLabel>
        {label}
        {required && <span className="text-course"> *</span>}
      </FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-base outline-none transition focus:border-course focus:ring-2 focus:ring-course/30"
      />
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        backgroundImage:
          "linear-gradient(90deg, var(--course-primary), color-mix(in srgb, var(--course-primary) 60%, black), var(--course-secondary))",
        backgroundSize: "180% auto",
        animation: "lx-shine 8s linear infinite",
      }}
      className="rounded-full px-7 py-3 text-sm font-semibold text-course-contrast shadow-[0_16px_40px_-12px_color-mix(in_srgb,var(--course-primary)_50%,transparent)] transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:animate-none"
    >
      {children}
    </button>
  );
}

function SlotSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="skeleton h-[68px] rounded-xl" />
      ))}
    </div>
  );
}

function EmptyState({ reason }: { reason?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-black/10 py-12 text-center">
      <div className="text-3xl">⛳</div>
      <p className="mt-3 text-sm font-medium text-foreground/70">
        No tee times available
      </p>
      <p className="mt-1 text-xs text-foreground/45">
        {reason ?? "Try another date or course."}
      </p>
    </div>
  );
}

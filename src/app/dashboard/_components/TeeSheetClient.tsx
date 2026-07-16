"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWalkIn, editBooking, collectPayment, checkPaymentStatus, setBookingStatus, getLastPayment, cancelPendingPayment } from "../actions";
import { cancelBookingAction } from "../actions";
import { formatCentsCompact } from "@/lib/money";
import { minutesToTime } from "@/lib/datetime";
import { QuickChargePanel } from "./QuickChargePanel";

export interface SlotBooking {
  id: string;
  golferName: string;
  golferEmail: string;
  golferPhone: string | null;
  numPlayers: number;
  holes: number;
  withCart: boolean;
  source: string;
  memberCount: number;
  paymentStatus: string;
  status: string;
  totalCents: number;
  amountPaidCents: number;
  taxCents: number;
  notes: string | null;
  refundCents: number; // amount that would be refunded to the golfer on cancel (0 if not paid online)
  withinCancelWindow: boolean; // within the 24h cancellation window
}

export interface Slot {
  key: string;
  layoutId: string;
  layoutName: string;
  time: string;
  label: string;
  ampm: "AM" | "PM";
  maxPlayers: number;
  spotsLeft: number;
  closed: boolean;
  reason?: string;
  bookings: SlotBooking[];
}

export interface ShopItem {
  id: string;
  name: string;
  priceCents: number;
}

const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("");
const PAID = new Set(["paid_online", "paid_in_person", "refunded"]);
const pillCls = (ps: string) => (PAID.has(ps) ? "bg-[#eaf7ef] text-[#2f855a]" : ps === "partially_paid" ? "bg-[#e7f0fb] text-[#2b6cb0]" : "bg-[#fef3e2] text-[#b7791f]");
const pillLabel = (b: SlotBooking) =>
  b.paymentStatus === "paid_online" ? "Paid" :
  b.paymentStatus === "paid_in_person" ? "Paid at counter" :
  b.paymentStatus === "partially_paid" ? "Part-paid" :
  b.paymentStatus === "refunded" ? "Refunded" :
  b.source === "online" ? "Unpaid" : b.source === "phone" ? "Phone · unpaid" : "Walk-in · unpaid";

/** Shows that a booking includes member(s), so the shop can spot member play. */
function MemberTag({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  return (
    <span title={`${count} member${count === 1 ? "" : "s"} in this group`} className="inline-flex items-center gap-1 rounded-full bg-[#fdf4e3] px-2 py-1 text-[11px] font-semibold text-[#b7791f]">
      ★ {count === 1 ? "Member" : `${count} members`}
    </span>
  );
}

/** Small "riding" indicator so the shop can see at a glance who took a cart. */
function CartTag({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span title="Riding — cart" aria-label="cart" className="inline-flex items-center gap-1 rounded-full bg-[#eef4ff] px-2 py-1 text-[11px] font-semibold text-[#2b6cb0]">
      🛺 Cart
    </span>
  );
}

export function TeeSheetClient({ date, slots, layouts, shopItems, taxRateBps, inPersonFeePerPlayer }: { date: string; slots: Slot[]; layouts: { id: string; name: string }[]; shopItems: ShopItem[]; taxRateBps: number; inPersonFeePerPlayer: number }) {
  const [view, setView] = useState<"list" | "grid">("grid");
  const [filter, setFilter] = useState("all");
  const [menu, setMenu] = useState<string | null>(null); // popover id
  const [showPast, setShowPast] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [nowTime, setNowTime] = useState("");

  useEffect(() => {
    const v = localStorage.getItem("lx_teeview");
    if (v === "grid" || v === "list") setView(v);
  }, []);

  useEffect(() => {
    const updateNowTime = () => {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      setNowTime(minutesToTime(mins));
    };
    updateNowTime();
    const timer = setInterval(updateNowTime, 60000);
    return () => clearInterval(timer);
  }, []);

  const setViewP = (v: "list" | "grid") => { setView(v); localStorage.setItem("lx_teeview", v); };

  // Check if a slot time has already passed. Must compare date AND time, not just time of day.
  // Bug fix: Previously only compared time-of-day, causing future dates to show no slots when
  // current time (e.g. 22:24) was past all slot times (e.g. 7:00-18:00).
  const isPastSlot = (time: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const today = `${year}-${month}-${day}`;

    if (date < today) return true; // Viewing a past date: all slots are past
    if (date > today) return false; // Viewing a future date: no slots are past yet

    // Viewing today: check if the time of day has passed
    const [h, m] = time.split(":").map(Number);
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return h * 60 + m < nowMins;
  };

  let shown = slots.filter((s) => filter === "all" || s.layoutId === filter);
  if (!showPast) shown = shown.filter((s) => !isPastSlot(s.time));
  if (openOnly) shown = shown.filter((s) => !s.closed && s.spotsLeft > 0);

  const groups = [
    { title: "Morning", slots: shown.filter((s) => s.ampm === "AM") },
    { title: "Afternoon", slots: shown.filter((s) => s.ampm === "PM") },
  ].filter((g) => g.slots.length > 0);

  return (
    <div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-full bg-black/[0.05] p-1">
          <button onClick={() => setFilter("all")} className={chip(filter === "all")}>All</button>
          {layouts.map((l) => <button key={l.id} onClick={() => setFilter(l.id)} className={chip(filter === l.id)}>{l.name}</button>)}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={() => setShowPast(!showPast)} className="text-xs font-medium text-foreground/55 transition hover:text-foreground/80">
            {showPast ? "Hide past" : "Show past"}
          </button>
          <button onClick={() => setOpenOnly(!openOnly)} className="text-xs font-medium text-foreground/55 transition hover:text-foreground/80">
            {openOnly ? "All slots" : "Open only"}
          </button>
          <div className="flex gap-1 rounded-full bg-black/[0.05] p-1">
            <button onClick={() => setViewP("list")} className={chip(view === "list")}>▤ List</button>
            <button onClick={() => setViewP("grid")} className={chip(view === "grid")}>▦ Grid</button>
          </div>
        </div>
      </div>

      <QuickChargePanel shopItems={shopItems} taxRateBps={taxRateBps} />

      {groups.length > 0 && (
        <div className="mt-4 flex items-center gap-2 px-1 py-2 text-sm text-foreground/50">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500"></span>
          <span className="font-medium">Now: {nowTime}</span>
        </div>
      )}

      {groups.length === 0 && (
        <div className="mt-4 rounded-2xl bg-white p-14 text-center text-sm text-foreground/50 shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)]">No tee times scheduled for this day.</div>
      )}

      {groups.map((g) => {
        const filled = g.slots.filter((s) => s.bookings.length > 0).length;
        return (
          <div key={g.title} className="mt-4 overflow-hidden rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)]">
            <div className="flex items-center justify-between px-4 py-3.5">
              <b className="text-sm font-bold">{g.title}</b>
              <span className="text-sm text-foreground/45">{filled} of {g.slots.length} times in use</span>
            </div>

            {view === "list" ? (
              <div>
                {g.slots.map((s) => (
                  <div key={s.key} className="flex items-start gap-4 border-t border-black/[0.04] px-4 py-3">
                    <span className="w-[62px] shrink-0 pt-1 font-mono font-semibold">{s.label}<small className="ml-1 text-[11px] font-medium text-foreground/40">{s.ampm}</small></span>
                    <span className="hidden w-24 shrink-0 pt-1 text-xs text-foreground/45 sm:block">{s.layoutName}</span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {s.closed ? (
                        <div className="text-sm text-foreground/40">Closed{s.reason ? ` — ${s.reason}` : ""}</div>
                      ) : (
                        <>
                          {s.bookings.map((b) => (
                            <div key={b.id} className="relative">
                              <button onClick={() => setMenu(menu === b.id ? null : b.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-black/[0.03]">
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eef0f3] text-[11px] font-bold text-[#5a6069]">{initials(b.golferName)}</span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold">{b.golferName}</span>
                                  <span className="block truncate text-xs text-foreground/50">{b.numPlayers} players · {b.holes}H</span>
                                </span>
                                <span className="ml-auto flex shrink-0 items-center gap-1.5">
                                  <MemberTag count={b.memberCount} />
                                  <CartTag on={b.withCart} />
                                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${pillCls(b.paymentStatus)}`}>{pillLabel(b)}</span>
                                </span>
                              </button>
                              {menu === b.id && <DetailsPopover booking={b} onClose={() => setMenu(null)} shopItems={shopItems} taxRateBps={taxRateBps} inPersonFeePerPlayer={inPersonFeePerPlayer} />}
                            </div>
                          ))}
                          {s.spotsLeft > 0 && <AddRow slot={s} date={date} open={menu === s.key} onToggle={() => setMenu(menu === s.key ? null : s.key)} onClose={() => setMenu(null)} />}
                        </>
                      )}
                    </div>
                    <span className="shrink-0 pt-1 text-xs font-medium text-foreground/40">{s.maxPlayers - s.spotsLeft}/{s.maxPlayers}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
                {g.slots.map((s) => (
                  <div key={s.key} className="rounded-2xl border border-black/[0.06] bg-white p-3 relative">
                    {s.spotsLeft === 0 && !s.closed && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/[0.02]">
                        <div className="font-display text-sm font-bold text-foreground/40">Full</div>
                      </div>
                    )}
                    <div className="flex items-baseline justify-between">
                      <div className="font-mono text-base font-bold">{s.label}<small className="ml-1 text-[11px] text-foreground/40">{s.ampm}</small></div>
                      <div className="text-[11px] font-medium text-foreground/40">{s.maxPlayers - s.spotsLeft}/{s.maxPlayers}</div>
                    </div>
                    <div className="mt-1 text-[11px] text-foreground/45">{s.layoutName}</div>
                    <div className="mt-2 space-y-1">
                      {s.closed ? <div className="text-xs text-foreground/40">Closed</div> : (
                        <>
                          {s.bookings.map((b) => (
                            <div key={b.id} className="relative">
                              <button onClick={() => setMenu(menu === b.id ? null : b.id)} className="flex w-full items-center gap-1.5 truncate rounded-lg bg-gradient-to-r from-linx-green/10 to-linx-green/5 px-2.5 py-2 text-left text-xs font-semibold border border-linx-green/20 transition hover:bg-linx-green/15 hover:border-linx-green/40">
                                <span className="truncate text-foreground/80">{b.golferName.split(" ")[0]}</span>
                                <span className="text-[10px] text-foreground/60">·</span>
                                <span className="shrink-0 text-foreground/70">{b.numPlayers}p</span>
                                {b.withCart && <span className="ml-auto shrink-0" title="Riding — cart" aria-label="cart">🛺</span>}
                                <span className="ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={{backgroundColor: b.paymentStatus === "paid_online" ? "#eaf7ef" : b.paymentStatus === "paid_in_person" ? "#fef3e2" : "#e7f0fb", color: b.paymentStatus === "paid_online" ? "#2f855a" : b.paymentStatus === "paid_in_person" ? "#b7791f" : "#2b6cb0"}}>{b.paymentStatus === "paid_online" ? "Paid" : b.paymentStatus === "paid_in_person" ? "Counter" : b.paymentStatus === "partially_paid" ? "Partial" : "Unpaid"}</span>
                              </button>
                              {menu === b.id && <DetailsPopover booking={b} onClose={() => setMenu(null)} shopItems={shopItems} taxRateBps={taxRateBps} inPersonFeePerPlayer={inPersonFeePerPlayer} grid />}
                            </div>
                          ))}
                          {s.spotsLeft > 0 && <AddRow slot={s} date={date} open={menu === s.key} onToggle={() => setMenu(menu === s.key ? null : s.key)} onClose={() => setMenu(null)} grid />}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function chip(active: boolean) {
  return `rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${active ? "bg-white text-[#14181c] shadow-sm" : "text-foreground/55"}`;
}

function AddRow({ slot, date, open, onToggle, onClose, grid }: { slot: Slot; date: string; open: boolean; onToggle: () => void; onClose: () => void; grid?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [withCart, setWithCart] = useState(false);
  const router = useRouter();

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("layoutId", slot.layoutId); fd.set("date", date); fd.set("slotTime", slot.time);
    fd.set("withCart", String(withCart));
    startTransition(async () => {
      const res = await createWalkIn(fd);
      if (res.ok) { onClose(); router.refresh(); } else setErr(res.message);
    });
  }

  return (
    <div className="relative">
      <button onClick={onToggle} className={`${grid ? "w-full text-xs" : "text-xs"} rounded-md border border-dashed border-[#cdd6cf] px-2 py-1 font-semibold text-[#12a06f] transition hover:bg-[#f2fbf6]`}>
        + Add group · {slot.spotsLeft} spot{slot.spotsLeft === 1 ? "" : "s"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/45" onClick={onClose} />
          <form onSubmit={add} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-[420px] rounded-xl border border-black/10 bg-white shadow-2xl">
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Add group · {slot.label} {slot.ampm}</h3>
                  <button type="button" onClick={onClose} className="text-foreground/50 hover:text-foreground/70 text-lg font-semibold">✕</button>
                </div>
                <input name="golferName" required placeholder="Golfer name" className="w-full rounded-lg border border-black/10 px-3 py-2 text-xs outline-none focus:border-[#12a06f]" />
                <div className="flex gap-2">
                  <select name="numPlayers" className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-xs">
                    {Array.from({ length: slot.spotsLeft }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} player{n === 1 ? "" : "s"}</option>)}
                  </select>
                  <select name="holes" className="rounded-lg border border-black/10 px-3 py-2 text-xs"><option value="18">18H</option><option value="9">9H</option></select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/70 mb-2">Source</label>
                  <select name="source" className="w-full rounded-lg border border-black/10 px-3 py-2 text-xs">
                    <option value="walkin">Walk-in</option>
                    <option value="phone">Phone</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground/70 mb-2">Transport</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setWithCart(false)}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${!withCart ? "bg-[#12a06f] text-white" : "bg-black/[0.04] text-foreground/70 hover:bg-black/[0.08]"}`}
                    >
                      Walking
                    </button>
                    <button
                      type="button"
                      onClick={() => setWithCart(true)}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${withCart ? "bg-[#12a06f] text-white" : "bg-black/[0.04] text-foreground/70 hover:bg-black/[0.08]"}`}
                    >
                      Cart
                    </button>
                  </div>
                </div>
                {err && <p className="text-xs font-medium text-red-600">{err}</p>}
                <div className="flex gap-2 pt-2">
                  <button disabled={pending} className="flex-1 rounded-full bg-[#12a06f] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{pending ? "Adding…" : "Add"}</button>
                  <button type="button" onClick={onClose} className="rounded-full px-3 py-2 text-xs font-medium text-foreground/50 hover:bg-black/[0.04]">Cancel</button>
                </div>
              </div>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function DetailsPopover({ booking, onClose, grid, shopItems, taxRateBps, inPersonFeePerPlayer }: { booking: SlotBooking; onClose: () => void; grid?: boolean; shopItems: ShopItem[]; taxRateBps: number; inPersonFeePerPlayer: number }) {
  const [mode, setMode] = useState<"view" | "edit" | "cancel" | "collect" | "review" | "paying">("view");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [collType, setCollType] = useState<"full" | "players" | "custom">("full");
  const [collPlayers, setCollPlayers] = useState(1);
  const [collCustom, setCollCustom] = useState("");
  const [collMethod, setCollMethod] = useState<"terminal" | "cash">("terminal");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [showAddOns, setShowAddOns] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"processing" | "success" | "failed" | null>(null);
  const [lastPayment, setLastPayment] = useState<{ state: string; amountCents: number; method: string; createdAt: string } | null>(null);
  const router = useRouter();

  // Fetch last payment when popover opens
  useEffect(() => {
    if (mode === "view") {
      getLastPayment(booking.id).then(setLastPayment).catch(() => {});
    }
  }, [mode, booking.id]);
  const manual = booking.source !== "online";
  const remaining = Math.max(0, booking.totalCents - booking.amountPaidCents);
  const perPlayer = booking.numPlayers > 0 ? Math.round(booking.totalCents / booking.numPlayers) : booking.totalCents;
  const isPaid = remaining <= 0 || booking.paymentStatus === "paid_online";

  // Live charge preview — mirrors planCharge + withAddons on the server.
  const baseAmount =
    collType === "full" ? remaining
    : collType === "players" ? Math.min(remaining, Math.max(1, collPlayers) * perPlayer)
    : Math.min(remaining, Math.round((Number(collCustom) || 0) * 100));
  const isCard = collMethod === "terminal";
  const feeTotal = inPersonFeePerPlayer * booking.numPlayers;
  const feeCents = isCard ? feeTotal : 0;
  const addonsCents = shopItems.reduce((n, it) => n + it.priceCents * (cart[it.id] ?? 0), 0);
  const taxableCents = addonsCents + (booking.taxCents > 0 ? 0 : baseAmount);
  const taxCents = Math.round((taxableCents * taxRateBps) / 10000);
  const chargeTotal = baseAmount + feeCents + addonsCents + taxCents;
  const addQty = (id: string, d: number) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + d) }));

  function doCollect(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("bookingId", booking.id);
    fd.set("mode", collType);
    fd.set("method", collMethod);
    for (const [id, qty] of Object.entries(cart)) if (qty > 0) fd.set(`item_${id}`, String(qty));
    setPaymentStatus("processing");
    setMode("paying");
    startTransition(async () => {
      const res = await collectPayment(fd);
      setPaymentStatus(res.ok ? "success" : "failed");
      setMsg(res.message);
      if (res.ok) { setTimeout(() => { onClose(); router.refresh(); }, 2000); }
    });
  }

  function doCancelStuckPayment() {
    startTransition(async () => {
      const res = await cancelPendingPayment(booking.id);
      setMsg(res.message);
      if (res.ok) {
        setPaymentStatus(null);
        if (mode === "paying") setMode("collect");
        getLastPayment(booking.id).then(setLastPayment).catch(() => {});
        router.refresh();
      }
    });
  }

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("bookingId", booking.id);
    startTransition(async () => {
      const res = await editBooking(fd);
      setMsg(res.message);
      if (res.ok) { onClose(); router.refresh(); }
    });
  }
  // Within-window cancel always overrides the 24h policy (that's why we prompt).
  function doCancel() {
    startTransition(async () => {
      const res = await cancelBookingAction(booking.id, reason, true);
      setMsg(res.message);
      if (res.ok) { onClose(); router.refresh(); }
    });
  }
  // Outside the 24h window: cancel immediately, no confirmation step.
  function doCancelDirect() {
    startTransition(async () => {
      const res = await cancelBookingAction(booking.id, "", false);
      setMsg(res.message);
      if (res.ok) { onClose(); router.refresh(); }
    });
  }
  function doStatus(status: "confirmed" | "checked_in" | "no_show") {
    startTransition(async () => {
      const res = await setBookingStatus(booking.id, status);
      setMsg(res.message);
      if (res.ok) router.refresh();
    });
  }

  // Poll for payment status while processing
  useEffect(() => {
    if (mode !== "paying" || paymentStatus !== "processing") return;

    let elapsed = 0;
    const pollInterval = setInterval(async () => {
      elapsed += 1500;

      // Timeout escalation
      if (elapsed > 120000) { // 2 minute hard stop
        setPaymentStatus("failed");
        setMsg("Payment processing took too long. Please try again or contact support.");
        clearInterval(pollInterval);
        return;
      }
      if (elapsed > 90000) { // 90 second warning
        setMsg("This is taking longer than expected. Tap the card again or try a different card.");
      } else if (elapsed > 30000) { // 30 second notice
        setMsg("Still processing payment...");
      }

      const status = await checkPaymentStatus(booking.id);
      if (status.status !== "pending") {
        setPaymentStatus(status.status === "succeeded" ? "success" : status.status);
        setMsg(null);
        if (status.status === "succeeded") {
          setTimeout(() => { onClose(); router.refresh(); }, 2000);
        }
        clearInterval(pollInterval);
      }
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [mode, paymentStatus, booking.id, onClose, router]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/45" onClick={onClose} />
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto`}>
        <div className={`w-full ${mode === "collect" ? "max-w-[650px]" : "max-w-[420px]"} rounded-xl border border-black/10 bg-white shadow-2xl my-auto`}>
        {mode === "view" && (
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{booking.golferName}</div>
              <button type="button" onClick={onClose} className="text-foreground/50 hover:text-foreground/70 text-lg font-semibold leading-none">✕</button>
            </div>
            <div className="text-xs text-foreground/50">{booking.golferEmail}</div>
            {booking.golferPhone && <div className="text-xs text-foreground/50">{booking.golferPhone}</div>}
            <div className="flex items-center justify-between text-xs text-foreground/70">
              <span>{booking.numPlayers} players · {booking.holes}H · {booking.withCart ? "🛺 Cart" : "🚶 Walking"}{booking.memberCount > 0 ? ` · ★ ${booking.memberCount} member${booking.memberCount === 1 ? "" : "s"}` : ""}</span>
              <span className="font-semibold">{formatCentsCompact(booking.totalCents)}</span>
            </div>
            {booking.amountPaidCents > 0 && remaining > 0 && (
              <div className="text-[11px] font-medium text-[#b7791f]">Paid {formatCentsCompact(booking.amountPaidCents)} · {formatCentsCompact(remaining)} due</div>
            )}
            {isPaid && booking.paymentStatus !== "unpaid" && <div className="text-[11px] font-medium text-[#2f855a]">Paid in full</div>}
            {lastPayment && (
              <div className={`rounded-lg p-2.5 text-[11px] font-medium ${lastPayment.state === "succeeded" ? "bg-[#eaf7ef] text-[#2f855a]" : lastPayment.state === "pending" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span>{lastPayment.state === "succeeded" ? "✓" : lastPayment.state === "pending" ? "⏳" : "✗"} Last payment: {lastPayment.state} · {formatCentsCompact(lastPayment.amountCents)}</span>
                  {lastPayment.state === "pending" && lastPayment.method === "terminal" && (
                    <button type="button" disabled={pending} onClick={doCancelStuckPayment} className="shrink-0 rounded-full border border-amber-700/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50">
                      {pending ? "Cancelling…" : "Cancel"}
                    </button>
                  )}
                </div>
              </div>
            )}
            {booking.notes && (
              <div className="rounded-lg bg-[#fdf6e3] px-2.5 py-1.5 text-[11px] leading-snug text-[#8a6d3b]">
                <span className="font-semibold">Request: </span>{booking.notes}
              </div>
            )}
            {booking.status === "checked_in" && <div className="text-[11px] font-semibold text-[#2b6cb0]">✓ Checked in</div>}
            {booking.status === "no_show" && <div className="text-[11px] font-semibold text-[#c0392b]">No-show</div>}
            {booking.status !== "cancelled" && (
              <div className="space-y-2 pt-2">
                {!isPaid && (
                  <button onClick={() => { setMode("collect"); setMsg(null); }} className="w-full rounded-full bg-[#12a06f] px-3 py-1.5 text-xs font-semibold text-white">Collect payment · {formatCentsCompact(remaining)}</button>
                )}
                <div className="flex gap-2">
                  {booking.status === "checked_in" || booking.status === "no_show" ? (
                    <button disabled={pending} onClick={() => doStatus("confirmed")} className="flex-1 rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-black/[0.04] disabled:opacity-50">Undo</button>
                  ) : (
                    <>
                      <button disabled={pending} onClick={() => doStatus("checked_in")} className="flex-1 rounded-full bg-[#eaf1fb] px-3 py-1.5 text-xs font-semibold text-[#2b6cb0] hover:brightness-95 disabled:opacity-50">Check in</button>
                      <button disabled={pending} onClick={() => doStatus("no_show")} className="flex-1 rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-foreground/60 hover:bg-black/[0.04] disabled:opacity-50">No-show</button>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setMode("edit")} className="flex-1 rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-black/[0.04]">Edit</button>
                  <button
                    disabled={pending}
                    onClick={() => (booking.withinCancelWindow ? setMode("cancel") : doCancelDirect())}
                    className="flex-1 rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {!booking.withinCancelWindow && booking.refundCents > 0 ? `Cancel · refund ${formatCentsCompact(booking.refundCents)}` : "Cancel"}
                  </button>
                </div>
                {msg && <p className="text-[11px] font-medium text-foreground/60">{msg}</p>}
              </div>
            )}
          </div>
        )}

        {mode === "collect" && (
          <form onSubmit={doCollect} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">Collect payment · {formatCentsCompact(remaining)} due</div>
              <button type="button" onClick={onClose} className="text-foreground/50 hover:text-foreground/70 text-lg font-semibold leading-none">✕</button>
            </div>

            {/* Collection type buttons */}
            <div>
              <div className="text-xs font-semibold text-foreground/70 mb-2">Collection type</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCollType("full")}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${collType === "full" ? "bg-[#12a06f] text-white" : "bg-black/[0.04] text-foreground/70 hover:bg-black/[0.08]"}`}
                >
                  Whole remaining
                </button>
                <button
                  type="button"
                  onClick={() => setCollType("players")}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${collType === "players" ? "bg-[#12a06f] text-white" : "bg-black/[0.04] text-foreground/70 hover:bg-black/[0.08]"}`}
                >
                  By player
                </button>
                <button
                  type="button"
                  onClick={() => setCollType("custom")}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${collType === "custom" ? "bg-[#12a06f] text-white" : "bg-black/[0.04] text-foreground/70 hover:bg-black/[0.08]"}`}
                >
                  Custom
                </button>
              </div>
            </div>

            {/* Player count for per-player mode */}
            {collType === "players" && (
              <div>
                <label className="block text-xs font-semibold text-foreground/70 mb-2">Number of players ({formatCentsCompact(perPlayer)} each)</label>
                <select name="players" value={collPlayers} onChange={(e) => setCollPlayers(Number(e.target.value))} className="w-full rounded-lg border border-black/10 px-3 py-2 text-xs">
                  {Array.from({ length: booking.numPlayers }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}

            {/* Custom amount */}
            {collType === "custom" && (
              <div>
                <label className="block text-xs font-semibold text-foreground/70 mb-2">Amount</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">$</span>
                  <input name="customAmount" value={collCustom} onChange={(e) => setCollCustom(e.target.value)} inputMode="decimal" placeholder="0.00" className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-xs outline-none focus:border-[#12a06f]" />
                </div>
              </div>
            )}

            {/* Shop items grid */}
            {shopItems.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-foreground/70 mb-2">Add-ons</div>
                <div className="grid grid-cols-4 gap-2">
                  {shopItems.map((it) => {
                    const qty = cart[it.id] ?? 0;
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => addQty(it.id, 1)}
                        className={`flex flex-col items-center gap-1 rounded-lg p-2 transition ${qty > 0 ? "bg-[#12a06f]/10 border-2 border-[#12a06f]" : "border-2 border-black/10 hover:border-black/20"}`}
                      >
                        <div className="text-center">
                          <div className="text-[10px] font-semibold text-foreground/80 line-clamp-2">{it.name}</div>
                          <div className="text-[9px] text-foreground/60 mt-0.5">{formatCentsCompact(it.priceCents)}</div>
                        </div>
                        {qty > 0 && (
                          <div className="mt-1 rounded-full bg-[#12a06f] px-1.5 py-0.5 text-[9px] font-bold text-white">
                            {qty}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Payment method buttons */}
            <div>
              <div className="text-xs font-semibold text-foreground/70 mb-2">Payment method</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCollMethod("terminal")}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${collMethod === "terminal" ? "bg-[#12a06f] text-white" : "bg-black/[0.04] text-foreground/70 hover:bg-black/[0.08]"}`}
                >
                  Card reader
                </button>
                <button
                  type="button"
                  onClick={() => setCollMethod("cash")}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${collMethod === "cash" ? "bg-[#12a06f] text-white" : "bg-black/[0.04] text-foreground/70 hover:bg-black/[0.08]"}`}
                >
                  Cash
                </button>
              </div>
            </div>

            {/* Email field */}
            <div>
              <label className="block text-xs font-semibold text-foreground/70 mb-2">Email (receipt)</label>
              <input name="receiptEmail" type="email" defaultValue={booking.golferEmail || ""} placeholder="(optional)" className="w-full rounded-lg border border-black/10 px-3 py-2 text-xs outline-none focus:border-[#12a06f]" />
            </div>

            {/* Price breakdown */}
            <div className="rounded-lg bg-black/[0.02] p-3 text-xs space-y-1">
              {baseAmount > 0 && <div className="flex justify-between"><span>Green / cart</span><span>{formatCentsCompact(baseAmount)}</span></div>}
              {addonsCents > 0 && <div className="flex justify-between"><span>Pro shop items</span><span>{formatCentsCompact(addonsCents)}</span></div>}
              {feeCents + taxCents > 0 && <div className="flex justify-between"><span>Taxes and fees</span><span>{formatCentsCompact(feeCents + taxCents)}</span></div>}
              <div className="border-t border-black/5 pt-1 flex justify-between font-semibold"><span>Total</span><span>{formatCentsCompact(chargeTotal)}</span></div>
            </div>

            {msg && <p className="text-xs font-medium text-red-600">{msg}</p>}

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button disabled={pending || chargeTotal <= 0} className="flex-1 rounded-full bg-[#12a06f] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{pending ? "…" : `Continue · ${formatCentsCompact(chargeTotal)}`}</button>
              <button type="button" onClick={() => { setMode("view"); setShowAddOns(false); }} className="rounded-full px-3 py-2 text-xs font-medium text-foreground/50 hover:bg-black/[0.04]">Back</button>
            </div>
          </form>
        )}

        {mode === "paying" && (
          <div className="p-5 flex flex-col items-center gap-4">
            {paymentStatus === "processing" && (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#12a06f] border-t-transparent" />
                <div className="text-center">
                  <div className="font-semibold text-foreground">Processing payment...</div>
                  <div className="text-sm text-foreground/60 mt-1">Charging {formatCentsCompact(chargeTotal)}</div>
                  {collMethod === "terminal" && <div className="text-xs text-foreground/50 mt-2">Waiting for card reader...</div>}
                </div>
              </>
            )}
            {paymentStatus === "success" && (
              <>
                <div className="text-4xl">✓</div>
                <div className="text-center">
                  <div className="font-semibold text-[#2f855a] text-lg">Payment successful</div>
                  <div className="text-sm text-foreground/60 mt-1">Charged {formatCentsCompact(chargeTotal)}</div>
                </div>
              </>
            )}
            {paymentStatus === "failed" && (
              <>
                <div className="text-4xl">✗</div>
                <div className="text-center">
                  <div className="font-semibold text-red-600 text-lg">Payment failed</div>
                  {msg && <div className="text-sm text-foreground/60 mt-1">{msg}</div>}
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={() => { setPaymentStatus(null); setMode("collect"); }} className="rounded-full px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-black/[0.04]">Try again</button>
                    {msg?.toLowerCase().includes("already in progress") && (
                      <button type="button" disabled={pending} onClick={doCancelStuckPayment} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                        {pending ? "Cancelling…" : "Cancel stuck payment"}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {mode === "edit" && (
          <form onSubmit={save} className="p-5 space-y-3">
            <div className="text-sm font-semibold text-foreground">Edit booking</div>
            <input name="golferName" defaultValue={booking.golferName} required placeholder="Name" className="w-full rounded-lg border border-black/10 px-3 py-2 text-xs outline-none focus:border-[#12a06f]" />
            <input name="golferPhone" defaultValue={booking.golferPhone ?? ""} placeholder="Phone" className="w-full rounded-lg border border-black/10 px-3 py-2 text-xs outline-none focus:border-[#12a06f]" />
            <div className="flex gap-2">
              <select name="numPlayers" defaultValue={booking.numPlayers} disabled={!manual} className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-xs disabled:opacity-50">{[1,2,3,4].map((n)=><option key={n} value={n}>{n}p</option>)}</select>
              <select name="holes" defaultValue={booking.holes} disabled={!manual} className="rounded-lg border border-black/10 px-3 py-2 text-xs disabled:opacity-50"><option value="18">18H</option><option value="9">9H</option></select>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="withCart" defaultChecked={booking.withCart} disabled={!manual} className="h-3.5 w-3.5" />cart</label>
            </div>
            {!manual && <p className="text-[11px] text-foreground/45">Group size is locked for online (paid) bookings.</p>}
            {msg && <p className="text-xs font-medium text-red-600">{msg}</p>}
            <div className="flex gap-2 pt-2">
              <button disabled={pending} className="flex-1 rounded-full bg-[#12a06f] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
              <button type="button" onClick={() => setMode("view")} className="rounded-full px-3 py-2 text-xs font-medium text-foreground/50 hover:bg-black/[0.04]">Back</button>
            </div>
          </form>
        )}

        {mode === "cancel" && (
          <div className="p-5 space-y-3">
            <div className="text-sm font-semibold text-foreground">Cancel this booking?</div>
            <p className="text-[11px] font-medium text-[#c0392b]">Within 24 hours of the tee time — this overrides the cancellation policy.</p>
            {booking.refundCents > 0 && (
              <p className="text-[11px] font-medium text-[#2f855a]">This will refund the player {formatCentsCompact(booking.refundCents)} (LinxTimes fee kept).</p>
            )}
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" className="w-full rounded-lg border border-black/10 px-3 py-2 text-xs outline-none focus:border-[#12a06f]" />
            {msg && <p className="text-xs font-medium text-red-600">{msg}</p>}
            <div className="flex gap-2 pt-2">
              <button onClick={doCancel} disabled={pending} className="flex-1 rounded-full bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{pending ? "Cancelling…" : "Confirm cancel"}</button>
              <button onClick={() => setMode("view")} className="rounded-full px-3 py-2 text-xs font-medium text-foreground/50 hover:bg-black/[0.04]">Back</button>
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
}

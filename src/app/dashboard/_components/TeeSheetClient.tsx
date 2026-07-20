"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createWalkIn,
  editBooking,
  collectPayment,
  checkPaymentStatus,
  setBookingStatus,
  cancelPendingPayment,
  searchMembersForLinking,
  calculateMemberShare,
  cancelBookingAction,
} from "../actions";
import { formatCentsCompact } from "@/lib/money";
import { minutesToTime, timeToMinutes, todayKeyInTz, nowMinutesInTz, formatTimeLabel } from "@/lib/datetime";
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
// ONE payment-pill language, used by both list and grid views:
// green = money collected, blue = partial, gray = refunded, amber = money owed.
const PAID = new Set(["paid_online", "paid_in_person"]);
const pillCls = (ps: string) =>
  PAID.has(ps) ? "bg-[#eaf7ef] text-[#2f855a]"
  : ps === "partially_paid" ? "bg-[#e7f0fb] text-[#2b6cb0]"
  : ps === "refunded" ? "bg-black/[0.06] text-foreground/50"
  : "bg-[#fef3e2] text-[#b7791f]";
const pillLabel = (b: SlotBooking) =>
  b.paymentStatus === "paid_online" ? "Paid" :
  b.paymentStatus === "paid_in_person" ? "Paid · counter" :
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

export function TeeSheetClient({ date, slots, layouts, shopItems, taxRateBps, inPersonFeePerPlayer, timezone }: { date: string; slots: Slot[]; layouts: { id: string; name: string }[]; shopItems: ShopItem[]; taxRateBps: number; inPersonFeePerPlayer: number; timezone: string }) {
  const [view, setView] = useState<"list" | "grid">("grid");
  const [filter, setFilter] = useState("all");
  const [menu, setMenu] = useState<string | null>(null); // popover id
  const [showPast, setShowPast] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  // Minutes-since-midnight in the COURSE's timezone (not the browser's), or -1
  // when the sheet isn't showing the course's current day.
  const [nowMins, setNowMins] = useState(-1);
  const nowLineRef = useRef<HTMLDivElement>(null);
  const scrolledRef = useRef(false);

  useEffect(() => {
    const v = localStorage.getItem("lx_teeview");
    if (v === "grid" || v === "list") setView(v);
  }, []);

  useEffect(() => {
    const update = () => setNowMins(todayKeyInTz(timezone) === date ? nowMinutesInTz(timezone) : -1);
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [timezone, date]);

  const setViewP = (v: "list" | "grid") => { setView(v); localStorage.setItem("lx_teeview", v); };

  // A slot has passed if the viewed date is behind the course's current day,
  // or (today) its time is behind the course-local clock.
  const todayKey = todayKeyInTz(timezone);
  const isPastSlot = (time: string) => {
    if (date < todayKey) return true;
    if (date > todayKey) return false;
    return timeToMinutes(time) < (nowMins >= 0 ? nowMins : 0);
  };

  let shown = slots.filter((s) => filter === "all" || s.layoutId === filter);
  if (!showPast) shown = shown.filter((s) => !isPastSlot(s.time));
  if (openOnly) shown = shown.filter((s) => !s.closed && s.spotsLeft > 0);

  const groups = [
    { title: "Morning", slots: shown.filter((s) => s.ampm === "AM") },
    { title: "Afternoon", slots: shown.filter((s) => s.ampm === "PM") },
  ].filter((g) => g.slots.length > 0);

  // The red "now" line renders immediately before this slot (today only).
  const firstFutureKey =
    nowMins >= 0
      ? groups.flatMap((g) => g.slots).find((s) => timeToMinutes(s.time) > nowMins)?.key ?? null
      : null;
  const nowLabel = nowMins >= 0 ? formatTimeLabel(minutesToTime(nowMins)) : "";

  // Open the sheet scrolled to the current time, once per mount.
  useEffect(() => {
    if (!scrolledRef.current && firstFutureKey && nowLineRef.current) {
      nowLineRef.current.scrollIntoView({ block: "center" });
      scrolledRef.current = true;
    }
  }, [firstFutureKey]);

  const nowLine = (
    <div ref={nowLineRef} className="flex items-center px-1 py-0.5" aria-label={`Current time ${nowLabel}`} style={{ gridColumn: "1 / -1" }}>
      <span className="shrink-0 rounded-full bg-[#e0533a] px-2 py-0.5 text-[9px] font-bold text-white">{nowLabel}</span>
      <span className="ml-1.5 h-[2px] flex-1 rounded bg-[#e0533a]" />
    </div>
  );

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

      {groups.length === 0 && (
        <div className="mt-4 rounded-2xl bg-white p-14 text-center shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)]">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#12a06f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto opacity-70" aria-hidden="true">
            <path d="M6 21V3l12 4.5L6 12" /><circle cx="15" cy="20" r="1.6" />
          </svg>
          <p className="mt-4 text-sm font-medium text-foreground/70">No tee times scheduled for this day</p>
          <p className="mt-1 text-xs text-foreground/45">Set a weekly schedule for this course and its tee times will appear here.</p>
          <Link href="/dashboard/tee-times" className="mt-5 inline-block rounded-full bg-[#12a06f] px-5 py-2 text-xs font-semibold text-white transition hover:brightness-110">
            Set up tee times
          </Link>
        </div>
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
                  <div key={s.key}>
                  {s.key === firstFutureKey && nowLine}
                  <div className="flex items-start gap-4 border-t border-black/[0.04] px-4 py-3">
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
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
                {g.slots.map((s) => (
                  <Fragment key={s.key}>
                  {s.key === firstFutureKey && nowLine}
                  <div className="rounded-2xl border border-black/[0.06] bg-white p-3 relative">
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
                                <span className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${pillCls(b.paymentStatus)}`}>
                                  {b.paymentStatus === "paid_online" ? "Paid" : b.paymentStatus === "paid_in_person" ? "Paid · counter" : b.paymentStatus === "partially_paid" ? "Part-paid" : b.paymentStatus === "refunded" ? "Refunded" : "Unpaid"}
                                </span>
                              </button>
                              {menu === b.id && <DetailsPopover booking={b} onClose={() => setMenu(null)} shopItems={shopItems} taxRateBps={taxRateBps} inPersonFeePerPlayer={inPersonFeePerPlayer} grid />}
                            </div>
                          ))}
                          {s.spotsLeft > 0 && <AddRow slot={s} date={date} open={menu === s.key} onToggle={() => setMenu(menu === s.key ? null : s.key)} onClose={() => setMenu(null)} grid />}
                        </>
                      )}
                    </div>
                  </div>
                  </Fragment>
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
    // The server reads checkbox convention: present+"on" = cart, absent = walking.
    if (withCart) fd.set("withCart", "on"); else fd.delete("withCart");
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
  const [collType, setCollType] = useState<"full" | "players" | "custom" | "member">("full");
  const [collPlayers, setCollPlayers] = useState(1);
  const [collCustom, setCollCustom] = useState("");
  const [collMethod, setCollMethod] = useState<"terminal" | "cash">("terminal");
  // Member collection: search a member, charge their share at THEIR rate
  // (green-fee override / cart-included honored server-side).
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<{ id: string; name: string }[]>([]);
  const [selMember, setSelMember] = useState<{ id: string; name: string; cents: number } | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [showAddOns, setShowAddOns] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"processing" | "success" | "failed" | null>(null);
  // The exact Payment row in flight on the reader — polled until the Stripe
  // webhook settles it, so an older payment can never be mistaken for it.
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const [lastPayment, setLastPayment] = useState<{ state: string; amountCents: number; method: string; createdAt: string } | null>(null);
  const router = useRouter();

  // Fetch last payment when popover opens
  useEffect(() => {
    if (mode === "view") {
      // TODO: Re-enable after launch
    }
  }, [mode, booking.id]);
  const manual = booking.source !== "online";
  const remaining = Math.max(0, booking.totalCents - booking.amountPaidCents);
  const perPlayer = booking.numPlayers > 0 ? Math.round(booking.totalCents / booking.numPlayers) : booking.totalCents;
  const isPaid = remaining <= 0 || booking.paymentStatus === "paid_online";

  // Debounced member search while the Member collection type is active.
  useEffect(() => {
    if (collType !== "member" || memberQuery.trim().length < 2) {
      setMemberResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchMembersForLinking(memberQuery).then(setMemberResults).catch(() => setMemberResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [collType, memberQuery]);

  function pickMember(m: { id: string; name: string }) {
    setMemberResults([]);
    setMemberQuery(m.name);
    calculateMemberShare(booking.id, m.id)
      .then((res) => {
        if (res) setSelMember({ id: m.id, name: res.memberName, cents: res.memberCents });
        else setMsg("Couldn't calculate the member rate.");
      })
      .catch(() => setMsg("Couldn't calculate the member rate."));
  }

  // Live charge preview — mirrors planCharge + withAddons on the server.
  const baseAmount =
    collType === "full" ? remaining
    : collType === "players" ? Math.min(remaining, Math.max(1, collPlayers) * perPlayer)
    : collType === "member" ? Math.min(remaining, selMember?.cents ?? 0)
    : Math.min(remaining, Math.round((Number(collCustom) || 0) * 100));
  const isCard = collMethod === "terminal";
  // Mirror planCharge: the in-person fee is per PLAYER COVERED (min 1 when any
  // money is collected), never prorated down to ~$0 on a small custom charge.
  const playersCovered = baseAmount > 0
    ? (perPlayer > 0 ? Math.max(1, Math.min(booking.numPlayers, Math.round(baseAmount / perPlayer))) : 1)
    : 0;
  const feeCents = isCard ? inPersonFeePerPlayer * playersCovered : 0;
  const addonsCents = shopItems.reduce((n, it) => n + it.priceCents * (cart[it.id] ?? 0), 0);
  // Pro-shop transactions add a flat $0.50 (mirrors withAddons on the server).
  const proshopFeeCents = addonsCents > 0 ? 50 : 0;
  const taxableCents = addonsCents + (booking.taxCents > 0 ? 0 : baseAmount);
  const taxCents = Math.round((taxableCents * taxRateBps) / 10000);
  const chargeTotal = baseAmount + feeCents + proshopFeeCents + addonsCents + taxCents;
  const addQty = (id: string, d: number) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + d) }));

  function doCollect(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (collType === "member" && !selMember) {
      setMsg("Search and select a member first.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.set("bookingId", booking.id);
    fd.set("mode", collType);
    fd.set("method", collMethod);
    if (collType === "member" && selMember) fd.set("memberId", selMember.id);
    for (const [id, qty] of Object.entries(cart)) if (qty > 0) fd.set(`item_${id}`, String(qty));
    setPaymentStatus("processing");
    setActivePaymentId(null);
    setMode("paying");
    startTransition(async () => {
      const res = await collectPayment(fd);
      if (!res.ok) {
        setPaymentStatus("failed");
        setMsg(res.message);
        return;
      }
      if (collMethod === "cash") {
        // Cash settles synchronously on the server — success is real.
        setPaymentStatus("success");
        setMsg(res.message);
        setTimeout(() => { onClose(); router.refresh(); }, 1000);
        return;
      }
      // Terminal: the charge was only PUSHED to the reader — the golfer still
      // has to tap. Stay in "processing" and let the poll below flip to
      // success/failed off the webhook-settled Payment row.
      setActivePaymentId(res.paymentId ?? null);
      setMsg(res.message);
    });
  }

  function doCancelStuckPayment() {
    startTransition(async () => {
      const res = await cancelPendingPayment(booking.id);
      setMsg(res.message);
      if (res.ok) {
        setPaymentStatus(null);
        setActivePaymentId(null);
        if (mode === "paying") setMode("collect");
        // TODO: Re-enable getLastPayment after launch
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

  // Poll the in-flight payment while processing. Only starts once the server
  // action has returned the new payment's id — polling "latest payment for the
  // booking" before then could match an OLD succeeded payment and show a false
  // success.
  useEffect(() => {
    if (mode !== "paying" || paymentStatus !== "processing" || !activePaymentId) return;

    let elapsed = 0;
    const POLL_MS = 800; // snappier detection once the golfer taps
    const pollInterval = setInterval(async () => {
      elapsed += POLL_MS;

      // Timeout escalation (a card tap shouldn't take a minute).
      if (elapsed > 60000) { // 1 minute hard stop
        setPaymentStatus("failed");
        setMsg("Payment timed out. Cancel and try again, or use cash.");
        clearInterval(pollInterval);
        return;
      }
      if (elapsed > 30000) { // 30 second warning
        setMsg("Still waiting for the card — tap again or try a different card.");
      } else if (elapsed > 12000) { // 12 second notice
        setMsg("Waiting for the golfer to tap…");
      }

      const status = await checkPaymentStatus(booking.id, activePaymentId);
      if (status.status !== "pending") {
        setPaymentStatus(status.status === "succeeded" ? "success" : status.status);
        setMsg(status.status === "failed" ? status.errorMessage ?? null : null);
        if (status.status === "succeeded") {
          setTimeout(() => { onClose(); router.refresh(); }, 1000);
        }
        clearInterval(pollInterval);
      }
    }, POLL_MS);

    return () => clearInterval(pollInterval);
  }, [mode, paymentStatus, activePaymentId, booking.id, onClose, router]);

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

            {/* Collection type buttons — sized for a touchscreen at the counter */}
            <div>
              <div className="text-xs font-semibold text-foreground/70 mb-2">Collection type</div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["full", "Whole remaining"],
                  ["players", "By player"],
                  ["custom", "Custom"],
                  ["member", "Member rate"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setCollType(key); setMsg(null); }}
                    aria-pressed={collType === key}
                    className={`rounded-xl px-3 py-3 text-sm font-semibold transition ${collType === key ? "bg-[#12a06f] text-white shadow-sm" : "bg-black/[0.04] text-foreground/70 hover:bg-black/[0.08]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Player count for per-player mode */}
            {collType === "players" && (
              <div>
                <label className="block text-xs font-semibold text-foreground/70 mb-2">Number of players ({formatCentsCompact(perPlayer)} each)</label>
                <select name="players" value={collPlayers} onChange={(e) => setCollPlayers(Number(e.target.value))} className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm">
                  {Array.from({ length: booking.numPlayers }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}

            {/* Custom amount */}
            {collType === "custom" && (
              <div>
                <label className="block text-xs font-semibold text-foreground/70 mb-2">Amount</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">$</span>
                  <input name="customAmount" value={collCustom} onChange={(e) => setCollCustom(e.target.value)} inputMode="decimal" placeholder="0.00" className="flex-1 rounded-xl border border-black/10 px-3 py-3 text-sm outline-none focus:border-[#12a06f]" />
                </div>
              </div>
            )}

            {/* Member lookup — charges this member's own rate for their slot */}
            {collType === "member" && (
              <div>
                <label className="block text-xs font-semibold text-foreground/70 mb-2">Member</label>
                <div className="relative">
                  <input
                    value={memberQuery}
                    onChange={(e) => { setMemberQuery(e.target.value); setSelMember(null); }}
                    placeholder="Search member name or ID…"
                    className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm outline-none focus:border-[#12a06f]"
                  />
                  {memberResults.length > 0 && !selMember && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg">
                      {memberResults.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => pickMember(m)}
                          className="block w-full px-3.5 py-2.5 text-left text-sm font-medium transition hover:bg-black/[0.04]"
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selMember && (
                  <p className="mt-2 text-xs font-medium text-[#2f855a]">
                    ✓ {selMember.name} — member rate {formatCentsCompact(Math.min(remaining, selMember.cents))}
                  </p>
                )}
                {!selMember && memberQuery.trim().length >= 2 && memberResults.length === 0 && (
                  <p className="mt-2 text-xs text-foreground/45">No active members match.</p>
                )}
              </div>
            )}

            {/* Shop items grid — tap to add; selected items get a −/＋ stepper */}
            {shopItems.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-foreground/70 mb-2">Add-ons</div>
                <div className="grid grid-cols-3 gap-2">
                  {shopItems.map((it) => {
                    const qty = cart[it.id] ?? 0;
                    return (
                      <div
                        key={it.id}
                        className={`flex flex-col rounded-lg p-2 transition ${qty > 0 ? "bg-[#12a06f]/10 border-2 border-[#12a06f]" : "border-2 border-black/10"}`}
                      >
                        <button
                          type="button"
                          onClick={() => addQty(it.id, 1)}
                          className="flex-1 text-center"
                          aria-label={`Add ${it.name}`}
                        >
                          <div className="text-[11px] font-semibold text-foreground/80 line-clamp-2">{it.name}</div>
                          <div className="text-[10px] text-foreground/60 mt-0.5">{formatCentsCompact(it.priceCents)}</div>
                        </button>
                        {qty > 0 && (
                          <div className="mt-2 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => addQty(it.id, -1)}
                              aria-label={`Remove one ${it.name}`}
                              className="grid h-7 w-7 place-items-center rounded-full bg-white text-base font-bold text-[#12a06f] shadow-sm ring-1 ring-[#12a06f]/30 hover:bg-[#12a06f]/5"
                            >
                              −
                            </button>
                            <span className="text-sm font-bold text-[#12a06f]">{qty}</span>
                            <button
                              type="button"
                              onClick={() => addQty(it.id, 1)}
                              aria-label={`Add one ${it.name}`}
                              className="grid h-7 w-7 place-items-center rounded-full bg-white text-base font-bold text-[#12a06f] shadow-sm ring-1 ring-[#12a06f]/30 hover:bg-[#12a06f]/5"
                            >
                              ＋
                            </button>
                          </div>
                        )}
                      </div>
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
                  aria-pressed={collMethod === "terminal"}
                  className={`flex-1 rounded-xl px-3 py-3.5 text-sm font-semibold transition ${collMethod === "terminal" ? "bg-[#12a06f] text-white shadow-sm" : "bg-black/[0.04] text-foreground/70 hover:bg-black/[0.08]"}`}
                >
                  Card reader
                </button>
                <button
                  type="button"
                  onClick={() => setCollMethod("cash")}
                  aria-pressed={collMethod === "cash"}
                  className={`flex-1 rounded-xl px-3 py-3.5 text-sm font-semibold transition ${collMethod === "cash" ? "bg-[#12a06f] text-white shadow-sm" : "bg-black/[0.04] text-foreground/70 hover:bg-black/[0.08]"}`}
                >
                  Cash
                </button>
              </div>
            </div>

            {/* Email field */}
            <div>
              <label className="block text-xs font-semibold text-foreground/70 mb-2">Email (receipt)</label>
              <input name="receiptEmail" type="email" defaultValue={booking.golferEmail || ""} placeholder="(optional)" className="w-full rounded-xl border border-black/10 px-3 py-3 text-sm outline-none focus:border-[#12a06f]" />
            </div>

            {/* Price breakdown — the total is the anchor, readable from a step back */}
            <div className="rounded-xl bg-black/[0.02] p-3.5 text-sm space-y-1">
              {baseAmount > 0 && <div className="flex justify-between text-foreground/70"><span>Green / cart</span><span>{formatCentsCompact(baseAmount)}</span></div>}
              {addonsCents > 0 && <div className="flex justify-between text-foreground/70"><span>Pro shop items</span><span>{formatCentsCompact(addonsCents)}</span></div>}
              {feeCents + proshopFeeCents + taxCents > 0 && <div className="flex justify-between text-foreground/70"><span>Taxes and fees</span><span>{formatCentsCompact(feeCents + proshopFeeCents + taxCents)}</span></div>}
              <div className="border-t border-black/5 pt-2 mt-1 flex items-baseline justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-2xl font-bold text-[#0d3522]">{formatCentsCompact(chargeTotal)}</span>
              </div>
            </div>

            {msg && <p className="text-xs font-medium text-red-600">{msg}</p>}

            {/* Action buttons — named for what actually happens */}
            <div className="flex gap-2 pt-1">
              <button disabled={pending || chargeTotal <= 0} className="flex-1 rounded-full bg-[#12a06f] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50">
                {pending ? "…" : collMethod === "cash" ? `Record cash · ${formatCentsCompact(chargeTotal)}` : `Send to reader · ${formatCentsCompact(chargeTotal)}`}
              </button>
              <button type="button" onClick={() => { setMode("view"); setShowAddOns(false); }} className="rounded-full px-4 py-3 text-sm font-medium text-foreground/50 hover:bg-black/[0.04]">Back</button>
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
                  {collMethod === "terminal" && <div className="text-xs text-foreground/50 mt-2">Waiting for the golfer to tap...</div>}
                  {msg && <div className="text-xs text-amber-600 mt-2">{msg}</div>}
                </div>
                {/* Always let staff bail out — clears the reader and the pending
                    charge so they can retry or switch to cash immediately. */}
                {collMethod === "terminal" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={doCancelStuckPayment}
                    className="mt-1 rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    {pending ? "Cancelling…" : "Cancel payment"}
                  </button>
                )}
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
                    <button type="button" onClick={() => { setPaymentStatus(null); setActivePaymentId(null); setMode("collect"); }} className="rounded-full px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-black/[0.04]">Try again</button>
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

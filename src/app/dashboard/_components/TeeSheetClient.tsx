"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWalkIn, editBooking, collectPayment, setBookingStatus } from "../actions";
import { cancelBookingAction } from "../actions";
import { formatCentsCompact } from "@/lib/money";
import { minutesToTime } from "@/lib/datetime";

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
  const [view, setView] = useState<"list" | "grid">("list");
  const [filter, setFilter] = useState("all");
  const [menu, setMenu] = useState<string | null>(null); // popover id
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

  const shown = slots.filter((s) => filter === "all" || s.layoutId === filter);
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
        <div className="ml-auto flex gap-1 rounded-full bg-black/[0.05] p-1">
          <button onClick={() => setViewP("list")} className={chip(view === "list")}>▤ List</button>
          <button onClick={() => setViewP("grid")} className={chip(view === "grid")}>▦ Grid</button>
        </div>
      </div>

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
                  <div key={s.key} className="rounded-2xl border border-black/[0.06] bg-white p-3">
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
                              <button onClick={() => setMenu(menu === b.id ? null : b.id)} className="flex w-full items-center gap-1 truncate rounded-md bg-black/[0.03] px-2 py-1 text-left text-xs font-medium transition hover:bg-black/[0.06]">
                                <span className="truncate">{b.golferName.split(" ")[0]} · {b.numPlayers}</span>
                                {b.withCart && <span className="ml-auto shrink-0" title="Riding — cart" aria-label="cart">🛺</span>}
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
  const router = useRouter();

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("layoutId", slot.layoutId); fd.set("date", date); fd.set("slotTime", slot.time);
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
          <div className="fixed inset-0 z-10" onClick={onClose} />
          <form onSubmit={add} className="absolute left-0 top-[calc(100%+4px)] z-20 w-60 rounded-xl border border-black/10 bg-white p-3.5 shadow-xl">
            <div className="mb-2 text-xs font-semibold text-foreground/70">Add group · {slot.label} {slot.ampm}</div>
            <input name="golferName" required placeholder="Golfer name" className="w-full rounded-lg border border-black/10 px-2.5 py-1.5 text-xs outline-none focus:border-[#12a06f]" />
            <div className="mt-2 flex gap-2">
              <select name="numPlayers" className="flex-1 rounded-lg border border-black/10 px-2 py-1.5 text-xs">
                {Array.from({ length: slot.spotsLeft }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} player{n === 1 ? "" : "s"}</option>)}
              </select>
              <select name="holes" className="rounded-lg border border-black/10 px-2 py-1.5 text-xs"><option value="18">18H</option><option value="9">9H</option></select>
            </div>
            <select name="source" className="mt-2 w-full rounded-lg border border-black/10 px-2 py-1.5 text-xs"><option value="walkin">Walk-in</option><option value="phone">Phone</option></select>
            <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" name="withCart" className="h-3.5 w-3.5" /> Cart</label>
            {err && <p className="mt-2 text-xs font-medium text-red-600">{err}</p>}
            <div className="mt-2.5 flex gap-2">
              <button disabled={pending} className="flex-1 rounded-full bg-[#12a06f] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{pending ? "Adding…" : "Add"}</button>
              <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-xs font-medium text-foreground/50 hover:bg-black/[0.04]">Cancel</button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function DetailsPopover({ booking, onClose, grid, shopItems, taxRateBps, inPersonFeePerPlayer }: { booking: SlotBooking; onClose: () => void; grid?: boolean; shopItems: ShopItem[]; taxRateBps: number; inPersonFeePerPlayer: number }) {
  const [mode, setMode] = useState<"view" | "edit" | "cancel" | "collect">("view");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [collType, setCollType] = useState<"full" | "players" | "custom">("full");
  const [collPlayers, setCollPlayers] = useState(1);
  const [collCustom, setCollCustom] = useState("");
  const [collMethod, setCollMethod] = useState<"terminal" | "cash">("terminal");
  const [cart, setCart] = useState<Record<string, number>>({});
  const router = useRouter();
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
  const feeCents = isCard && booking.totalCents > 0 ? Math.round((feeTotal * baseAmount) / booking.totalCents) : 0;
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
    for (const [id, qty] of Object.entries(cart)) if (qty > 0) fd.set(`item_${id}`, String(qty));
    startTransition(async () => {
      const res = await collectPayment(fd);
      setMsg(res.message);
      if (res.ok) { onClose(); router.refresh(); }
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

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className={`absolute z-20 w-64 rounded-xl border border-black/10 bg-white p-3.5 text-left shadow-xl ${grid ? "left-0" : "left-11"} top-[calc(100%+4px)]`}>
        {mode === "view" && (
          <>
            <div className="font-semibold">{booking.golferName}</div>
            <div className="text-xs text-foreground/50">{booking.golferEmail}</div>
            {booking.golferPhone && <div className="text-xs text-foreground/50">{booking.golferPhone}</div>}
            <div className="mt-2 flex items-center justify-between text-xs text-foreground/70">
              <span>{booking.numPlayers} players · {booking.holes}H · {booking.withCart ? "🛺 Cart" : "🚶 Walking"}{booking.memberCount > 0 ? ` · ★ ${booking.memberCount} member${booking.memberCount === 1 ? "" : "s"}` : ""}</span>
              <span className="font-semibold">{formatCentsCompact(booking.totalCents)}</span>
            </div>
            {booking.amountPaidCents > 0 && remaining > 0 && (
              <div className="mt-1 text-[11px] font-medium text-[#b7791f]">Paid {formatCentsCompact(booking.amountPaidCents)} · {formatCentsCompact(remaining)} due</div>
            )}
            {isPaid && booking.paymentStatus !== "unpaid" && <div className="mt-1 text-[11px] font-medium text-[#2f855a]">Paid in full</div>}
            {booking.notes && (
              <div className="mt-2 rounded-lg bg-[#fdf6e3] px-2.5 py-1.5 text-[11px] leading-snug text-[#8a6d3b]">
                <span className="font-semibold">Request: </span>{booking.notes}
              </div>
            )}
            {booking.status === "checked_in" && <div className="mt-1 text-[11px] font-semibold text-[#2b6cb0]">✓ Checked in</div>}
            {booking.status === "no_show" && <div className="mt-1 text-[11px] font-semibold text-[#c0392b]">No-show</div>}
            {booking.status !== "cancelled" && (
              <div className="mt-3 space-y-2">
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
          </>
        )}

        {mode === "collect" && (
          <form onSubmit={doCollect}>
            <div className="mb-2 text-xs font-semibold text-foreground/70">Collect payment · {formatCentsCompact(remaining)} due</div>
            <div className="space-y-1.5 text-xs">
              <label className="flex items-center gap-2"><input type="radio" name="ct" checked={collType === "full"} onChange={() => setCollType("full")} /> Whole remaining · {formatCentsCompact(remaining)}</label>
              <label className="flex items-center gap-2"><input type="radio" name="ct" checked={collType === "players"} onChange={() => setCollType("players")} /> By player ({formatCentsCompact(perPlayer)} each)</label>
              <label className="flex items-center gap-2"><input type="radio" name="ct" checked={collType === "custom"} onChange={() => setCollType("custom")} /> Custom amount</label>
            </div>
            {collType === "players" && (
              <label className="mt-2 block text-xs text-foreground/60">How many players?
                <select name="players" value={collPlayers} onChange={(e) => setCollPlayers(Number(e.target.value))} className="ml-2 rounded-lg border border-black/10 px-2 py-1 text-xs">{Array.from({ length: booking.numPlayers }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select>
              </label>
            )}
            {collType === "custom" && (
              <div className="mt-2 flex items-center gap-1 text-xs"><span>$</span><input name="customAmount" value={collCustom} onChange={(e) => setCollCustom(e.target.value)} inputMode="decimal" placeholder="0.00" className="w-24 rounded-lg border border-black/10 px-2 py-1.5" /></div>
            )}

            {shopItems.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-foreground/70">Pro shop items</div>
                <div className="mt-1 max-h-28 space-y-1 overflow-auto pr-0.5">
                  {shopItems.map((it) => (
                    <div key={it.id} className="flex items-center gap-1.5 text-xs">
                      <span className="min-w-0 flex-1 truncate">{it.name} · {formatCentsCompact(it.priceCents)}</span>
                      <button type="button" onClick={() => addQty(it.id, -1)} className="grid h-5 w-5 place-items-center rounded border border-black/10 text-foreground/60 hover:bg-black/[0.04]">−</button>
                      <span className="w-4 text-center font-medium">{cart[it.id] ?? 0}</span>
                      <button type="button" onClick={() => addQty(it.id, 1)} className="grid h-5 w-5 place-items-center rounded border border-black/10 text-foreground/60 hover:bg-black/[0.04]">+</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 text-xs font-semibold text-foreground/70">How?</div>
            <div className="mt-1 flex gap-2 text-xs">
              <label className="flex flex-1 items-center gap-2 rounded-lg border border-black/10 px-2 py-1.5"><input type="radio" name="method" value="terminal" checked={collMethod === "terminal"} onChange={() => setCollMethod("terminal")} /> Card reader</label>
              <label className="flex flex-1 items-center gap-2 rounded-lg border border-black/10 px-2 py-1.5"><input type="radio" name="method" value="cash" checked={collMethod === "cash"} onChange={() => setCollMethod("cash")} /> Cash</label>
            </div>
            <input name="receiptEmail" type="email" defaultValue={booking.golferEmail || ""} placeholder="Email receipt to (optional)" className="mt-2 w-full rounded-lg border border-black/10 px-2.5 py-1.5 text-xs outline-none focus:border-[#12a06f]" />

            <div className="mt-2 space-y-0.5 border-t border-black/5 pt-2 text-[11px] text-foreground/60">
              {baseAmount > 0 && <div className="flex justify-between"><span>Green / cart</span><span>{formatCentsCompact(baseAmount)}</span></div>}
              {addonsCents > 0 && <div className="flex justify-between"><span>Pro shop items</span><span>{formatCentsCompact(addonsCents)}</span></div>}
              {feeCents > 0 && <div className="flex justify-between"><span>Service fee</span><span>{formatCentsCompact(feeCents)}</span></div>}
              {taxCents > 0 && <div className="flex justify-between"><span>Tax</span><span>{formatCentsCompact(taxCents)}</span></div>}
            </div>

            {msg && <p className="mt-2 text-xs font-medium text-red-600">{msg}</p>}
            <div className="mt-3 flex gap-2">
              <button disabled={pending || chargeTotal <= 0} className="flex-1 rounded-full bg-[#12a06f] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{pending ? "…" : `Charge ${formatCentsCompact(chargeTotal)}`}</button>
              <button type="button" onClick={() => setMode("view")} className="rounded-full px-3 py-1.5 text-xs font-medium text-foreground/50 hover:bg-black/[0.04]">Back</button>
            </div>
          </form>
        )}

        {mode === "edit" && (
          <form onSubmit={save}>
            <div className="mb-2 text-xs font-semibold text-foreground/70">Edit booking</div>
            <input name="golferName" defaultValue={booking.golferName} required placeholder="Name" className="w-full rounded-lg border border-black/10 px-2.5 py-1.5 text-xs outline-none focus:border-[#12a06f]" />
            <input name="golferPhone" defaultValue={booking.golferPhone ?? ""} placeholder="Phone" className="mt-2 w-full rounded-lg border border-black/10 px-2.5 py-1.5 text-xs outline-none focus:border-[#12a06f]" />
            <div className="mt-2 flex gap-2">
              <select name="numPlayers" defaultValue={booking.numPlayers} disabled={!manual} className="flex-1 rounded-lg border border-black/10 px-2 py-1.5 text-xs disabled:opacity-50">{[1,2,3,4].map((n)=><option key={n} value={n}>{n}p</option>)}</select>
              <select name="holes" defaultValue={booking.holes} disabled={!manual} className="rounded-lg border border-black/10 px-2 py-1.5 text-xs disabled:opacity-50"><option value="18">18H</option><option value="9">9H</option></select>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="withCart" defaultChecked={booking.withCart} disabled={!manual} className="h-3.5 w-3.5" />cart</label>
            </div>
            {!manual && <p className="mt-1.5 text-[11px] text-foreground/45">Group size is locked for online (paid) bookings.</p>}
            {msg && <p className="mt-2 text-xs font-medium text-red-600">{msg}</p>}
            <div className="mt-2.5 flex gap-2">
              <button disabled={pending} className="flex-1 rounded-full bg-[#12a06f] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
              <button type="button" onClick={() => setMode("view")} className="rounded-full px-3 py-1.5 text-xs font-medium text-foreground/50 hover:bg-black/[0.04]">Back</button>
            </div>
          </form>
        )}

        {mode === "cancel" && (
          <div>
            <div className="mb-2 text-xs font-semibold text-foreground/70">Cancel this booking?</div>
            <p className="mb-2 text-[11px] font-medium text-[#c0392b]">Within 24 hours of the tee time — this overrides the cancellation policy.</p>
            {booking.refundCents > 0 && (
              <p className="mb-2 text-[11px] font-medium text-[#2f855a]">This will refund the player {formatCentsCompact(booking.refundCents)} (LinxTimes fee kept).</p>
            )}
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" className="w-full rounded-lg border border-black/10 px-2.5 py-1.5 text-xs outline-none focus:border-[#12a06f]" />
            {msg && <p className="mt-2 text-xs font-medium text-red-600">{msg}</p>}
            <div className="mt-2.5 flex gap-2">
              <button onClick={doCancel} disabled={pending} className="flex-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{pending ? "Cancelling…" : "Confirm cancel"}</button>
              <button onClick={() => setMode("view")} className="rounded-full px-3 py-1.5 text-xs font-medium text-foreground/50 hover:bg-black/[0.04]">Back</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

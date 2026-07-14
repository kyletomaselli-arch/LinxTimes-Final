"use client";

import { useState } from "react";
import { formatCentsCompact } from "@/lib/money";
import { CancelBookingButton } from "./CancelBookingButton";

export interface EventBooking {
  id: string;
  golferName: string;
  golferEmail: string;
  golferPhone: string | null;
  numPlayers: number;
  holes: number;
  withCart: boolean;
  source: string;
  paymentStatus: string;
  status: string;
  slotTime: string;
  totalCents: number;
}

/** A booked tee time in the calendar. Click to see details + cancel. */
export function BookingEventCard({ booking }: { booking: EventBooking }) {
  const [open, setOpen] = useState(false);
  const paid = booking.paymentStatus === "paid_online";
  const cls = paid || booking.paymentStatus === "refunded"
    ? "bg-[#eef5f0] text-[#2f6b4c] border-[#dae8df]"
    : "bg-[#f5f3ec] text-[#7a6a45] border-[#e9e2d2]";

  return (
    <div className="relative h-full">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`h-full w-full rounded-[11px] border px-2.5 py-2 text-left text-[13px] transition hover:brightness-[0.98] ${cls}`}
      >
        <span className="block truncate font-semibold">{booking.golferName}</span>
        <span className="block truncate text-[11px] opacity-85">
          {booking.numPlayers} · {booking.holes}H{booking.withCart ? " · cart" : ""}
          {booking.source !== "online" ? ` · ${booking.source}` : ""}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-[calc(100%+4px)] z-20 w-60 rounded-xl border border-black/10 bg-white p-3.5 text-left shadow-xl">
            <div className="font-semibold text-foreground">{booking.golferName}</div>
            <div className="text-xs text-foreground/50">{booking.golferEmail}</div>
            {booking.golferPhone && <div className="text-xs text-foreground/50">{booking.golferPhone}</div>}
            <div className="mt-2 space-y-1 text-xs text-foreground/70">
              <div>{booking.numPlayers} players · {booking.holes} holes{booking.withCart ? " · cart" : ""}</div>
              <div className="flex items-center justify-between">
                <span className="capitalize">{booking.paymentStatus.replace("_", " ")}</span>
                <span className="font-semibold">{formatCentsCompact(booking.totalCents)}</span>
              </div>
            </div>
            {booking.status !== "cancelled" && (
              <div className="mt-3"><CancelBookingButton bookingId={booking.id} /></div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

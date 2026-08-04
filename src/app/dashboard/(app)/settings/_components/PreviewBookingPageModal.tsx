"use client";

import { useState } from "react";
import { addDays } from "@/lib/datetime";

interface PreviewData {
  courseName: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  announcement: string | null;
}

export function PreviewBookingPageModal({ data, isOpen, onClose }: { data: PreviewData; isOpen: boolean; onClose: () => void }) {
  const [selectedDate, setSelectedDate] = useState(0);

  if (!isOpen) return null;

  const today = new Date().toISOString().split("T")[0];
  const dayKeys = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  const style = {
    "--course-primary": data.primaryColor,
    "--course-secondary": data.secondaryColor,
  } as React.CSSProperties;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header with close button */}
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Booking page preview</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-foreground/60 hover:bg-black/[0.04]"
            aria-label="Close preview"
          >
            ✕
          </button>
        </div>

        {/* Preview content - scrollable */}
        <div className="flex-1 overflow-y-auto" style={style}>
          <div className="min-h-full">
            {/* Hero image section */}
            <div className="relative w-full" style={{ backgroundImage: data.heroImageUrl ? `url(${data.heroImageUrl})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
              <div className="relative h-64 w-full bg-gradient-to-b from-transparent to-white/80">
                {data.heroImageUrl && (
                  <img
                    src={data.heroImageUrl}
                    alt="Course hero"
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.opacity = "0";
                    }}
                  />
                )}
              </div>
            </div>

            {/* Main content */}
            <div className="bg-white">
              <div className="mx-auto max-w-2xl px-6 py-8">
                {/* Course header with logo and name */}
                <div className="flex items-start gap-4 mb-8">
                  {data.logoUrl && (
                    <img
                      src={data.logoUrl}
                      alt="Course logo"
                      className="h-20 w-20 rounded-lg object-cover flex-shrink-0 border border-black/10"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  <div className="flex-1">
                    <h1 className="font-display text-4xl font-semibold text-foreground">{data.courseName}</h1>
                    <p className="mt-1 text-sm text-foreground/60">Reserve your tee time</p>
                  </div>
                </div>

                {/* Announcement banner */}
                {data.announcement && (
                  <div className="mb-8 rounded-xl border-l-4 px-4 py-3" style={{ borderLeftColor: data.primaryColor, backgroundColor: `${data.primaryColor}08` }}>
                    <p className="text-sm font-medium text-foreground">{data.announcement}</p>
                  </div>
                )}

                {/* Day selector */}
                <div className="mb-8">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/45 mb-3">Select a day</h2>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {dayKeys.map((key, idx) => {
                      const date = new Date(key);
                      const dayNum = date.getDate();
                      const dayName = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][date.getDay()];
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedDate(idx)}
                          className="flex w-16 shrink-0 flex-col items-center rounded-xl border py-2.5 transition font-medium"
                          style={{
                            borderColor: selectedDate === idx ? data.primaryColor : "#e5e7eb",
                            backgroundColor: selectedDate === idx ? data.primaryColor : "white",
                            color: selectedDate === idx ? "white" : "#111827",
                          }}
                        >
                          <span className="text-[10px] font-semibold tracking-wide">{idx === 0 ? "TODAY" : dayName}</span>
                          <span className="text-base font-bold">{dayNum}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tee times grid */}
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/45 mb-3">Available tee times</h2>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {[
                      { time: "7:00 AM", spots: 4, price: "$50" },
                      { time: "7:15 AM", spots: 3, price: "$50" },
                      { time: "7:30 AM", spots: 2, price: "$50" },
                      { time: "7:45 AM", spots: 1, price: "$50" },
                      { time: "8:00 AM", spots: 0, price: "$50" },
                      { time: "8:15 AM", spots: 4, price: "$50" },
                    ].map((slot) => (
                      <button
                        key={slot.time}
                        className="rounded-xl border-2 p-3 text-left transition-all"
                        style={{
                          borderColor: slot.spots === 0 ? "#fed7aa" : data.primaryColor,
                          backgroundColor: slot.spots === 0 ? "#fffbeb" : "white",
                        }}
                      >
                        <div className="text-base font-semibold" style={{ color: slot.spots === 0 ? "#b45309" : data.primaryColor }}>
                          {slot.time}
                        </div>
                        <div className="mt-1 text-xs" style={{ color: slot.spots === 0 ? "#b45309" : "#666" }}>
                          {slot.spots === 0 ? "Full" : `${slot.spots} spot${slot.spots > 1 ? "s" : ""} · ${slot.price}/player`}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color palette reference */}
                <div className="mt-12 border-t border-black/10 pt-8">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground/45 mb-4">Your colors</h3>
                  <div className="flex gap-6">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-12 w-12 rounded-lg border border-black/10 shadow-sm"
                        style={{ backgroundColor: data.primaryColor }}
                      />
                      <div>
                        <div className="font-medium text-foreground text-sm">Primary</div>
                        <div className="text-xs text-foreground/50 font-mono">{data.primaryColor}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        className="h-12 w-12 rounded-lg border border-black/10 shadow-sm"
                        style={{ backgroundColor: data.secondaryColor }}
                      />
                      <div>
                        <div className="font-medium text-foreground text-sm">Secondary</div>
                        <div className="text-xs text-foreground/50 font-mono">{data.secondaryColor}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-black/10 bg-black/[0.02] px-6 py-4">
          <p className="text-xs text-foreground/50">Real-time preview with your current form values. Changes won't appear on your public page until you click "Save profile".</p>
        </div>
      </div>
    </div>
  );
}

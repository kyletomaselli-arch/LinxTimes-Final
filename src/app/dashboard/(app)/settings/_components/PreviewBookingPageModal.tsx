"use client";

import { useState } from "react";
import { addDays, dayOfWeek } from "@/lib/datetime";
import { courseThemeStyle } from "@/lib/theme";

interface PreviewData {
  courseName: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  announcement: string | null;
}

export function PreviewBookingPageModal({ data, isOpen, onClose }: { data: PreviewData; isOpen: boolean; onClose: () => void }) {
  const [selectedDay, setSelectedDay] = useState(0);

  if (!isOpen) return null;

  const today = new Date().toISOString().split("T")[0];
  const dayKeys = Array.from({ length: 60 }, (_, i) => addDays(today, i));

  const themeStyle = courseThemeStyle(data.primaryColor, data.secondaryColor);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header with close button */}
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Live preview</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-foreground/60 hover:bg-black/[0.04]"
            aria-label="Close preview"
          >
            ✕
          </button>
        </div>

        {/* Preview content - scrollable */}
        <div className="flex-1 overflow-y-auto" style={themeStyle}>
          <main className="relative min-h-full">
            {/* Aurora background (simplified) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="lx-aurora" style={{ mixBlendMode: "normal", opacity: 0.3 }}>
                <div className="lx-blob lx-blob-1" />
                <div className="lx-blob lx-blob-2" />
              </div>
            </div>

            {/* Main content */}
            <div className="relative z-10 mx-auto max-w-5xl px-5 pt-8 pb-16 sm:pt-12">
              {/* Branded hero section */}
              {data.heroImageUrl ? (
                <header className="animate-fade-up mb-6">
                  <div className="relative h-60 overflow-hidden rounded-[26px] shadow-[0_32px_84px_-34px_rgba(13,53,34,0.55)] sm:h-80">
                    <img
                      src={data.heroImageUrl}
                      alt={`${data.courseName} course`}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-center gap-4 p-6 sm:p-8">
                      {data.logoUrl ? (
                        <img
                          src={data.logoUrl}
                          alt={`${data.courseName} logo`}
                          className="h-14 w-14 rounded-2xl bg-white object-contain p-1.5 shadow-md sm:h-16 sm:w-16"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white font-display text-2xl font-semibold text-course shadow-md sm:h-16 sm:w-16">
                          {data.courseName.slice(0, 1)}
                        </div>
                      )}
                      <div>
                        <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl [text-shadow:0_1px_12px_rgba(0,20,8,0.6)]">
                          {data.courseName}
                        </h1>
                        <p className="mt-1 text-sm text-white/85">Book a tee time</p>
                      </div>
                    </div>
                  </div>
                </header>
              ) : (
                <header className="mb-8">
                  <div className="flex items-center gap-4">
                    {data.logoUrl ? (
                      <img
                        src={data.logoUrl}
                        alt={`${data.courseName} logo`}
                        className="h-16 w-16 rounded-2xl bg-white object-contain p-1.5 shadow-md"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white font-display text-2xl font-semibold text-course shadow-md">
                        {data.courseName.slice(0, 1)}
                      </div>
                    )}
                    <div>
                      <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
                        {data.courseName}
                      </h1>
                      <p className="mt-1 text-sm text-foreground/60">Book a tee time</p>
                    </div>
                  </div>
                </header>
              )}

              {/* Announcement banner */}
              {data.announcement && (
                <div className="mb-6 animate-fade-up rounded-xl border-l-4 px-4 py-3" style={{ borderLeftColor: data.primaryColor, backgroundColor: `${data.primaryColor}0a` }}>
                  <p className="text-sm font-medium text-foreground">{data.announcement}</p>
                </div>
              )}

              {/* Booking section */}
              <section className="mt-7 animate-fade-up">
                {/* Day selector */}
                <div className="mb-8">
                  <label className="block text-sm font-semibold uppercase tracking-wide text-foreground/45 mb-3">Select a day</label>
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
                    {dayKeys.slice(0, 20).map((key, idx) => {
                      const selected = idx === selectedDay;
                      const dow = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][dayOfWeek(key)];
                      const dayNum = Number(key.slice(8, 10));
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedDay(idx)}
                          className={`flex w-16 shrink-0 flex-col items-center rounded-xl border py-2.5 transition ${
                            selected
                              ? "border-course bg-course text-course-contrast shadow-md"
                              : "border-black/10 bg-white text-foreground/80 hover:border-course/50 hover:shadow-sm"
                          }`}
                          style={selected ? { borderColor: data.primaryColor, backgroundColor: data.primaryColor } : {}}
                        >
                          <span className={`text-[10px] font-semibold tracking-wide ${selected ? "opacity-85" : "text-foreground/45"}`}>
                            {idx === 0 ? "TODAY" : dow}
                          </span>
                          <span className="text-base font-semibold leading-tight">{dayNum}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tee times section */}
                <div>
                  <label className="block text-sm font-semibold uppercase tracking-wide text-foreground/45 mb-3">Available tee times</label>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                    {[
                      { time: "7:00 AM", spots: 4 },
                      { time: "7:15 AM", spots: 3 },
                      { time: "7:30 AM", spots: 2 },
                      { time: "7:45 AM", spots: 1 },
                      { time: "8:00 AM", spots: 0 },
                      { time: "8:15 AM", spots: 4 },
                      { time: "8:30 AM", spots: 3 },
                      { time: "8:45 AM", spots: 2 },
                    ].map((slot) => {
                      const isFull = slot.spots === 0;
                      return (
                        <button
                          key={slot.time}
                          disabled={isFull}
                          className={`group relative flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                            isFull
                              ? "cursor-not-allowed border-amber-300 bg-amber-50/60 hover:border-amber-400"
                              : "border-black/10 bg-white hover:border-course/50 hover:shadow-md hover:-translate-y-0.5"
                          }`}
                          style={
                            !isFull
                              ? ({ borderColor: data.primaryColor } as React.CSSProperties)
                              : undefined
                          }
                        >
                          <div className="flex w-full items-center justify-between gap-1.5">
                            <span className="text-base font-semibold" style={{ color: isFull ? "#b45309" : data.primaryColor }}>
                              {slot.time}
                            </span>
                          </div>
                          <span
                            className={`mt-1 text-xs ${
                              isFull ? "font-medium text-amber-700" : "opacity-60"
                            }`}
                          >
                            {isFull ? "Full" : `${slot.spots} spot${slot.spots > 1 ? "s" : ""} · $50/player`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color info */}
                <div className="mt-12 border-t border-black/10 pt-8">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/45 mb-4">Theme colors</h3>
                  <p className="text-xs text-foreground/50 mb-4">Primary is used for buttons and accents on the booking page. Secondary appears on the homepage "Add your course" CTA gradient.</p>
                  <div className="flex gap-6">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-12 w-12 rounded-lg border border-black/10 shadow-sm"
                        style={{ backgroundColor: data.primaryColor }}
                      />
                      <div>
                        <div className="font-medium text-foreground text-sm">Primary color</div>
                        <div className="text-xs text-foreground/50 font-mono">{data.primaryColor}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        className="h-12 w-12 rounded-lg border border-black/10 shadow-sm"
                        style={{ backgroundColor: data.secondaryColor }}
                      />
                      <div>
                        <div className="font-medium text-foreground text-sm">Secondary color</div>
                        <div className="text-xs text-foreground/50 font-mono">{data.secondaryColor}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </main>
        </div>

        {/* Footer */}
        <div className="border-t border-black/10 bg-black/[0.02] px-6 py-4">
          <p className="text-xs text-foreground/50">This preview uses your current unsaved form values. Golfers will see this layout when booking tee times.</p>
        </div>
      </div>
    </div>
  );
}

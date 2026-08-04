"use client";

import { useState } from "react";

interface PreviewData {
  courseName: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  announcement: string | null;
}

export function PreviewBookingPageModal({ data, isOpen, onClose }: { data: PreviewData; isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  const style = {
    "--course-primary": data.primaryColor,
    "--course-secondary": data.secondaryColor,
  } as React.CSSProperties;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
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
          <div className="min-h-full bg-gradient-to-b from-black/5 to-transparent">
            {/* Hero section */}
            {data.heroImageUrl && (
              <div className="relative h-48 w-full overflow-hidden">
                <img
                  src={data.heroImageUrl}
                  alt="Course hero"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}

            {/* Course info section */}
            <div className="bg-white px-6 py-8">
              <div className="mx-auto max-w-2xl">
                {/* Logo and name */}
                <div className="flex items-start gap-4 mb-6">
                  {data.logoUrl && (
                    <img
                      src={data.logoUrl}
                      alt="Course logo"
                      className="h-16 w-16 rounded-lg object-cover flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  <div>
                    <h1 className="font-display text-3xl font-semibold text-foreground">{data.courseName}</h1>
                    <p className="mt-1 text-sm text-foreground/60">Public booking page</p>
                  </div>
                </div>

                {/* Announcement banner */}
                {data.announcement && (
                  <div className="mb-6 rounded-xl border-l-4 p-4" style={{ borderLeftColor: data.primaryColor, backgroundColor: `${data.primaryColor}10` }}>
                    <p className="text-sm font-medium text-foreground">{data.announcement}</p>
                  </div>
                )}

                {/* Sample tee times section */}
                <div className="mt-8">
                  <h2 className="font-display text-lg font-semibold text-foreground mb-4">Available tee times</h2>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {/* Sample slots with the primary color */}
                    {["7:00 AM", "7:15 AM", "7:30 AM", "7:45 AM", "8:00 AM", "8:15 AM"].map((time) => (
                      <button
                        key={time}
                        className="rounded-xl border p-3 text-left transition"
                        style={{
                          borderColor: data.primaryColor,
                          color: data.primaryColor,
                        }}
                      >
                        <div className="text-base font-semibold">{time}</div>
                        <div className="mt-1 text-xs opacity-70">4 spots · $50/player</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* CTA button */}
                <div className="mt-8 flex gap-3">
                  <button
                    className="rounded-full px-6 py-3 font-semibold text-white"
                    style={{ backgroundColor: data.primaryColor }}
                  >
                    Select tee time
                  </button>
                </div>

                {/* Color reference */}
                <div className="mt-12 border-t border-black/10 pt-6">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/45 mb-3">Colors used</h3>
                  <div className="flex gap-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-8 w-8 rounded-lg border border-black/10"
                        style={{ backgroundColor: data.primaryColor }}
                      />
                      <div className="text-xs">
                        <div className="font-medium text-foreground">Primary</div>
                        <div className="text-foreground/50">{data.primaryColor}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-8 w-8 rounded-lg border border-black/10"
                        style={{ backgroundColor: data.secondaryColor }}
                      />
                      <div className="text-xs">
                        <div className="font-medium text-foreground">Secondary</div>
                        <div className="text-foreground/50">{data.secondaryColor}</div>
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
          <p className="text-xs text-foreground/50">This is a preview using your current form values. Changes won't appear on your public page until you save.</p>
        </div>
      </div>
    </div>
  );
}

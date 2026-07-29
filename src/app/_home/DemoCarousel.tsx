'use client';

import { useState } from 'react';
import Image from 'next/image';

type Slide = {
  badge: string;
  title: string;
  description: string;
  image: string;
};

const slides: Slide[] = [
  {
    badge: 'Tee times',
    title: 'Your live tee sheet, open to golfers 24/7',
    description:
      'Real availability and your real prices, updating as the day fills. Sold-out times turn into a waitlist instead of a lost golfer, and "1 spot left" does the selling for you.',
    image: '/demo-tee-times.png',
  },
  {
    badge: 'Checkout',
    title: 'No surprises at the last step',
    description:
      'Green fee, cart, and taxes are itemized before they pay — so nobody calls the pro shop to argue about a total. Members, promo codes, and rain checks apply right here.',
    image: '/demo-payment.png',
  },
  {
    badge: 'Pro shop',
    title: 'Run the whole day from one screen',
    description:
      'Every group, paid status, and open spot at a glance, with a now-line showing where the day is. Add walk-ins, take cash or card at the counter, edit or cancel — without leaving the page.',
    image: '/demo-pro-shop.png',
  },
  {
    badge: 'Reporting',
    title: 'Know what you made and what you owe',
    description:
      'Net to course, gross collected, and the sales tax you have to remit — split by online, walk-in, and phone. Export to CSV whenever your bookkeeper asks.',
    image: '/demo-reports.png',
  },
];

export function DemoCarousel() {
  const [i, setI] = useState(0);
  const slide = slides[i];
  const go = (n: number) => setI((n + slides.length) % slides.length);

  return (
    <section id="tour" className="relative z-10 mx-auto max-w-5xl scroll-mt-24 px-6 pb-24">
      <div className="text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-linx-green/70">
          A look inside
        </div>
        <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight">
          See exactly what you&rsquo;re signing up for.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-foreground/60">
          Real screens from the software — not mockups.
        </p>
      </div>

      <div className="mt-10 rounded-[32px] bg-white/50 p-4 shadow-[0_40px_120px_-50px_rgba(13,53,34,0.5)] ring-1 ring-white/70 backdrop-blur-xl sm:p-6">
        {/* Caption above the image so each shot is explained before you look at it */}
        <div className="px-2 pb-4 pt-2 sm:px-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-linx-green/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-linx-green ring-1 ring-linx-green/15">
            {slide.badge}
          </span>
          <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight">{slide.title}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/60">
            {slide.description}
          </p>
        </div>

        {/* Screenshot — framed so it reads as a screen, not page background */}
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-white shadow-[0_20px_50px_-20px_rgba(13,53,34,0.45)] ring-1 ring-linx-green/15">
          {slides.map((s, n) => (
            <Image
              key={s.image}
              src={s.image}
              alt={s.title}
              fill
              sizes="(max-width: 768px) 100vw, 900px"
              priority={n === 0}
              className={`object-cover object-top transition-opacity duration-300 ${
                n === i ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}

          <button
            onClick={() => go(i - 1)}
            aria-label="Previous screen"
            className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-linx-green shadow-lg ring-1 ring-black/5 transition hover:bg-white"
          >
            ←
          </button>
          <button
            onClick={() => go(i + 1)}
            aria-label="Next screen"
            className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-linx-green shadow-lg ring-1 ring-black/5 transition hover:bg-white"
          >
            →
          </button>
        </div>

        {/* Tabs / dots */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {slides.map((s, n) => (
            <button
              key={s.image}
              onClick={() => setI(n)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                n === i
                  ? 'bg-linx-green text-white shadow-md'
                  : 'bg-white/70 text-foreground/60 ring-1 ring-black/5 hover:bg-white'
              }`}
            >
              {s.badge}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

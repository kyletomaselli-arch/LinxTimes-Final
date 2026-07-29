const faqs = [
  {
    q: 'Do I have to give up tee times to be listed?',
    a: 'No. LinxTimes is software you run, not a marketplace you sell into. You never barter inventory, and we never resell your tee times. Every round is booked on your page, under your name, at your price.',
  },
  {
    q: 'Who owns the golfer relationship?',
    a: 'You do. Golfers book on your branded page, and the name, email, and phone on every booking are yours. There is no LinxTimes account for a golfer to create and no competing course shown next to yours.',
  },
  {
    q: 'How and when do I get paid?',
    a: 'Payments run through Stripe straight into your own connected Stripe account — we never hold your money in between. Payouts follow your normal Stripe schedule, so the money is on its way before the group finishes the front nine.',
  },
  {
    q: 'What about walk-ins, phone calls, and members?',
    a: 'All handled on the tee sheet. Staff can add a walk-in group, take cash or card at the counter, look up a member for member pricing, sell pro-shop items on the same ticket, and edit or cancel any booking.',
  },
  {
    q: 'Do I need to buy new hardware?',
    a: 'No. The dashboard runs in any browser on the desktop, tablet, or phone you already have. A Stripe card reader is optional and only needed if you want to take chip and tap payments at the counter.',
  },
  {
    q: 'Can I keep my current website?',
    a: 'Yes. Most courses keep their site and point their "Book a tee time" button at their LinxTimes page. Nothing else about your site has to change.',
  },
  {
    q: 'What happens when someone cancels?',
    a: 'You set the window and any cancellation fee. Inside those rules the refund is issued automatically and the spot goes straight back on the tee sheet — no phone call, no manual refund in Stripe.',
  },
  {
    q: 'How long does setup take?',
    a: 'Most courses are live the same day. You set your rates and tee-time intervals, connect Stripe, and we check that everything is configured before your page goes public.',
  },
];

export function Faq() {
  return (
    <section id="faq" className="relative z-10 mx-auto max-w-3xl scroll-mt-24 px-6 pb-24">
      <div className="text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-linx-green/70">
          Questions
        </div>
        <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight">
          The things courses ask first.
        </h2>
      </div>

      <div className="mt-10 divide-y divide-black/5 overflow-hidden rounded-3xl bg-white/55 shadow-[0_24px_60px_-40px_rgba(13,53,34,0.5)] ring-1 ring-white/70 backdrop-blur-xl">
        {faqs.map((f) => (
          <details key={f.q} className="group px-6 py-5 sm:px-8">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-semibold text-foreground marker:hidden">
              {f.q}
              <span className="shrink-0 text-xl text-linx-green/50 transition-transform duration-200 group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground/65">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

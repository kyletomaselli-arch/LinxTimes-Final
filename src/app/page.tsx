import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { NetworkGlobe } from "./_home/NetworkGlobe";
import { DemoCarousel } from "./_home/DemoCarousel";
import { Faq } from "./_home/Faq";

export default async function HomePage() {
  const courses = await prisma.course.findMany({
    where: { status: "active", latitude: { not: null }, longitude: { not: null } },
    select: { name: true, city: true, state: true, latitude: true, longitude: true },
  });
  const pins = courses.map((c) => ({
    name: c.name,
    city: [c.city, c.state].filter(Boolean).join(", "),
    lat: c.latitude as number,
    lng: c.longitude as number,
  }));

  return (
    <main id="main-content" className="relative min-h-screen overflow-hidden text-foreground">
      {/* Ambient aurora background */}
      <div className="lx-bg" aria-hidden="true">
        <div className="lx-aurora" style={{ mixBlendMode: "normal", opacity: 0.6 }}>
          <div className="lx-blob lx-blob-1" />
          <div className="lx-blob lx-blob-2" />
          <div className="lx-blob lx-blob-3" />
          <div className="lx-blob lx-blob-4" />
        </div>
        <div className="lx-wash" style={{ background: "linear-gradient(180deg,rgba(244,249,239,.4),rgba(233,242,227,.7))" }} />
      </div>

      {/* ---------------------------------------------------------------- Nav */}
      <header className="sticky top-0 z-30 w-full border-b border-linx-green/10 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
          <Link href="/" aria-label="LinxTimes home" className="shrink-0">
            <Image
              src="/logo-wordmark.png"
              alt="LinxTimes"
              width={520}
              height={128}
              priority
              className="h-8 w-auto sm:h-9"
            />
          </Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-3">
            <a href="#tour" className="hidden rounded-full px-3 py-1.5 text-foreground/60 transition hover:bg-black/[0.04] hover:text-foreground sm:block">Tour</a>
            <a href="#how" className="hidden rounded-full px-3 py-1.5 text-foreground/60 transition hover:bg-black/[0.04] hover:text-foreground sm:block">How it works</a>
            <a href="#payouts" className="hidden rounded-full px-3 py-1.5 text-foreground/60 transition hover:bg-black/[0.04] hover:text-foreground md:block">Payouts</a>
            <a href="#faq" className="hidden rounded-full px-3 py-1.5 text-foreground/60 transition hover:bg-black/[0.04] hover:text-foreground md:block">FAQ</a>
            <Link href="/dashboard/login" className="rounded-full px-3 py-1.5 font-medium text-foreground/70 transition hover:bg-black/[0.04]">Course login</Link>
            <Link href="/request" className="rounded-full bg-linx-green px-4 py-2 font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:brightness-110">Add your course</Link>
          </nav>
        </div>
      </header>

      {/* -------------------------------------------------------------- Hero */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pt-16 pb-16 text-center sm:pt-24">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/60 px-4 py-1.5 text-xs font-medium text-linx-green ring-1 ring-linx-green/15 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-linx-green" /> Built for independent golf courses
        </span>

        <h1 className="mx-auto mt-6 max-w-4xl font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
          Fill your tee sheet{" "}
          <span className="bg-gradient-to-r from-linx-green via-[#1aa37a] to-linx-gold bg-clip-text text-transparent">
            without giving it away.
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-foreground/65">
          Your own booking page and pro-shop dashboard — without trading tee times for exposure.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/request"
            style={{ backgroundImage: "linear-gradient(90deg,#0d3522,#14492f,#c9a84c)", backgroundSize: "180% auto", animation: "lx-shine 8s linear infinite" }}
            className="rounded-full px-7 py-3.5 text-sm font-semibold text-white shadow-[0_16px_40px_-12px_rgba(13,53,34,0.5)] transition hover:-translate-y-0.5"
          >
            Add your course
          </Link>
        </div>

        {/* Factual trust strip — no invented numbers. */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-foreground/45">
          <span>Secured by Stripe</span>
          <span className="hidden h-1 w-1 rounded-full bg-foreground/20 sm:block" />
          <span>You keep your tee times</span>
          <span className="hidden h-1 w-1 rounded-full bg-foreground/20 sm:block" />
          <span>Live the same day</span>
        </div>
      </section>

      {/* ------------------------------------------------- Hero product shot --
          Shows the actual app instead of a stock photo. Tilted slightly and
          faded into the page so it reads as depth, not as a pasted-in image. */}
      <section className="relative z-10 -mt-2 px-6 pb-20" aria-hidden="true">
        <div className="mx-auto max-w-5xl [perspective:2000px]">
          <div
            className="relative overflow-hidden rounded-2xl ring-1 ring-linx-green/15 shadow-[0_60px_120px_-40px_rgba(13,53,34,0.55)] [transform:rotateX(7deg)_scale(0.99)]"
            style={{
              maskImage: "linear-gradient(180deg,#000 62%,rgba(0,0,0,0.35) 86%,transparent 100%)",
              WebkitMaskImage: "linear-gradient(180deg,#000 62%,rgba(0,0,0,0.35) 86%,transparent 100%)",
            }}
          >
            <Image
              src="/demo-pro-shop.png"
              alt=""
              width={2880}
              height={1620}
              priority
              className="w-full"
            />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- Product tour */}
      <DemoCarousel />

      {/* ------------------------------------------------- Problem / contrast */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
        <div className="overflow-hidden rounded-[32px] ring-1 ring-white/70 shadow-[0_40px_120px_-50px_rgba(13,53,34,0.45)]">
          <div className="grid sm:grid-cols-2">
            {/* Old way */}
            <div className="bg-white/45 p-8 backdrop-blur-xl sm:p-10">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/40">
                How most courses run today
              </div>
              <ul className="mt-5 space-y-4 text-sm text-foreground/60">
                {[
                  "The phone rings while there is a line at the counter.",
                  "A booking site takes tee times as payment for exposure.",
                  "Golfers book through a brand that isn't yours.",
                  "Cash, cards, and a spreadsheet get reconciled after close.",
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/25" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* New way */}
            <div className="bg-gradient-to-br from-linx-green to-[#0a2a1b] p-8 text-white sm:p-10">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
                How it runs on LinxTimes
              </div>
              <ul className="mt-5 space-y-4 text-sm text-white/85">
                {[
                  "Golfers book themselves, at 11pm, without calling.",
                  "You keep every tee time. Nothing is bartered.",
                  "Your name is on the whole experience.",
                  "Online, walk-in, and counter sales land in one ledger.",
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <span className="mt-0.5 shrink-0 font-semibold text-linx-gold">✓</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ Live in 3 steps */}
      <section id="how" className="relative z-10 mx-auto max-w-5xl scroll-mt-24 px-6 pb-24">
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-linx-green/70">How it works</div>
          <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight">Live in three steps.</h2>
          <p className="mx-auto mt-4 max-w-xl text-foreground/60">
            No implementation project, no data migration, no six-week onboarding call series.
          </p>
        </div>

        <div className="relative mt-12">
          {/* Connecting rail */}
          <div className="absolute left-0 right-0 top-[38px] hidden h-px bg-gradient-to-r from-transparent via-linx-green/25 to-transparent sm:block" aria-hidden="true" />
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { n: "01", t: "Add your course", d: "Tell us about your course. We review and approve — usually the same day, not in six weeks." },
              { n: "02", t: "Set rates & connect Stripe", d: "Enter your green fees, cart fees, and tee-time intervals, then connect Stripe in a couple of clicks." },
              { n: "03", t: "Share your page", d: "Point your website's booking button at your new page. Golfers book and pay; the money routes itself." },
            ].map((s) => (
              <div key={s.n} className="group relative rounded-3xl bg-white/55 p-7 text-center shadow-[0_24px_60px_-40px_rgba(13,53,34,0.5)] ring-1 ring-white/70 backdrop-blur-xl transition hover:-translate-y-1">
                <div className="mx-auto flex h-[76px] w-[76px] items-center justify-center rounded-2xl bg-gradient-to-br from-linx-green to-[#1aa37a] font-display text-2xl font-semibold text-white shadow-lg ring-4 ring-white/70">
                  {s.n}
                </div>
                <div className="mt-5 font-display text-xl font-semibold">{s.t}</div>
                <p className="mt-2 text-sm leading-relaxed text-foreground/60">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- Payouts */}
      <section id="payouts" className="relative z-10 mx-auto max-w-5xl scroll-mt-24 px-6 pb-24">
        <div className="rounded-[32px] bg-white/55 p-8 shadow-[0_40px_120px_-50px_rgba(13,53,34,0.5)] ring-1 ring-white/70 backdrop-blur-xl sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-center">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-linx-green/70">Getting paid</div>
              <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight">
                The money goes to you, not through us.
              </h2>
              <p className="mt-4 max-w-md leading-relaxed text-foreground/60">
                Every booking is a Stripe payment into your own connected account — we never hold
                your revenue. Sales tax is tracked separately, so you always know what you owe.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["Your Stripe account", "Automatic refunds", "Sales tax broken out", "CSV export"].map((chip) => (
                  <span key={chip} className="rounded-full bg-linx-green/8 px-3 py-1.5 text-xs font-semibold text-linx-green ring-1 ring-linx-green/15">
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            {/* Flow diagram */}
            <div className="rounded-3xl bg-gradient-to-br from-[#f6faf3] to-[#eaf3e5] p-6 ring-1 ring-linx-green/10 sm:p-8">
              {[
                { k: "1", t: "Golfer pays on your page", d: "Card, Apple Pay, or Google Pay" },
                { k: "2", t: "Green + cart fees route to you", d: "Straight into your Stripe balance" },
                { k: "3", t: "LinxTimes takes its per-player fee", d: "Only on rounds actually booked" },
                { k: "4", t: "Stripe pays out on your schedule", d: "Same account you already control" },
              ].map((row, idx, arr) => (
                <div key={row.k} className="relative flex gap-4 pb-6 last:pb-0">
                  {idx < arr.length - 1 && (
                    <span className="absolute left-[15px] top-8 h-full w-px bg-linx-green/15" aria-hidden="true" />
                  )}
                  <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linx-green text-xs font-semibold text-white">
                    {row.k}
                  </span>
                  <div className="pt-1">
                    <div className="text-sm font-semibold text-foreground">{row.t}</div>
                    <div className="text-xs text-foreground/50">{row.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Features */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-linx-green/70">Everything included</div>
          <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight">One system for the whole operation.</h2>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: "layout-board", t: "Live tee sheet", d: "Every group, paid status, and open spot on one screen." },
            { icon: "users", t: "Walk-ins & phone bookings", d: "Add a group at the counter in seconds — same ledger as online." },
            { icon: "credit-card", t: "Counter payments", d: "Cash or card, split by player, with pro-shop items on the same ticket." },
            { icon: "tag", t: "Members, promos & rain checks", d: "Member pricing, discount codes, and credits applied at checkout." },
            { icon: "chart-bar", t: "Reporting that reconciles", d: "Net, gross, and sales tax owed — split by booking source." },
            { icon: "device-mobile", t: "Works on what you have", d: "Any browser, any device. A card reader is optional." },
          ].map((f) => (
            <div key={f.t} className="rounded-3xl bg-white/55 p-7 shadow-[0_24px_60px_-40px_rgba(13,53,34,0.5)] ring-1 ring-white/70 backdrop-blur-xl transition hover:-translate-y-1">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-linx-green to-[#1aa37a] text-lg shadow-md text-white">
                <i className={`ti ti-${f.icon}`} aria-hidden="true" />
              </div>
              <div className="font-display text-lg font-semibold">{f.t}</div>
              <p className="mt-2 text-sm leading-relaxed text-foreground/60">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------- Network */}
      <section id="network" className="relative z-10 mx-auto max-w-5xl scroll-mt-24 px-6 pb-24">
        <div className="rounded-[32px] bg-white/50 p-6 shadow-[0_40px_120px_-50px_rgba(13,53,34,0.5)] ring-1 ring-white/70 backdrop-blur-xl sm:p-10">
          <div className="grid items-center gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-linx-green/70">Our network</div>
              <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight">
                {pins.length} course{pins.length === 1 ? "" : "s"} and growing.
              </h2>
              <p className="mt-4 max-w-md leading-relaxed text-foreground/60">
                Every course on LinxTimes lights up the map — and keeps its own page, its own pricing,
                and its own golfers. Joining adds reach without giving anything up.
              </p>
              <Link href="/request" className="mt-6 inline-block rounded-full bg-linx-green px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5">
                Add your course
              </Link>
            </div>
            <NetworkGlobe courses={pins} />
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- FAQ */}
      <Faq />

      {/* ------------------------------------------------------------ Final CTA */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24 text-center">
        <div className="rounded-[32px] bg-gradient-to-br from-linx-green to-[#0a2a1b] px-6 py-14 text-white shadow-[0_40px_120px_-50px_rgba(13,53,34,0.8)] sm:px-12 sm:py-20">
          <h2 className="mx-auto max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Your tee sheet is worth more than exposure.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-white/70">
            Get a booking page your course actually owns — and see the whole day, and the whole
            ledger, on one screen.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/request" className="rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-linx-green shadow-lg transition hover:-translate-y-0.5">
              Add your course
            </Link>
          </div>
        </div>

        <p className="mt-14 text-xs text-foreground/40">
          © {new Date().getFullYear()} LinxTimes · Powered by Stripe ·{" "}
          <Link href="/linxtimes-admin/login" className="text-foreground/20 transition hover:text-foreground/40">admin</Link>
        </p>
      </section>
    </main>
  );
}

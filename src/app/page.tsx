import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { NetworkGlobe } from "./_home/NetworkGlobe";

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
      {/* Ambient aurora background (no course map on the marketing site) */}
      <div className="lx-bg" aria-hidden="true">
        <div className="lx-aurora" style={{ mixBlendMode: "normal", opacity: 0.6 }}>
          <div className="lx-blob lx-blob-1" />
          <div className="lx-blob lx-blob-2" />
          <div className="lx-blob lx-blob-3" />
          <div className="lx-blob lx-blob-4" />
        </div>
        <div className="lx-wash" style={{ background: "linear-gradient(180deg,rgba(244,249,239,.4),rgba(233,242,227,.7))" }} />
      </div>

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linx-green font-display text-base font-semibold text-white">L</div>
          <span className="font-display text-lg font-semibold text-linx-green">LinxTimes</span>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <a href="#how" className="hidden text-foreground/60 hover:text-foreground sm:block">How it works</a>
          <a href="#network" className="hidden text-foreground/60 hover:text-foreground sm:block">Network</a>
          <Link href="/dashboard/login" className="rounded-full px-3 py-1.5 font-medium text-foreground/70 hover:bg-black/[0.04]">Course login</Link>
          <Link href="/request" className="rounded-full bg-linx-green px-4 py-2 font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:brightness-110">Request access</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pt-16 pb-20 text-center sm:pt-24">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/60 px-4 py-1.5 text-xs font-medium text-linx-green ring-1 ring-linx-green/15 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-linx-green" /> Tee-time booking, reimagined
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
          The booking page your{" "}
          <span className="bg-gradient-to-r from-linx-green via-[#1aa37a] to-linx-gold bg-clip-text text-transparent">golf course</span>{" "}
          deserves.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-foreground/60">
          A beautiful, branded tee-time page for every course — with automatic split payments and
          no monthly fee. You only pay per player booked.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/request"
            style={{ backgroundImage: "linear-gradient(90deg,#0d3522,#14492f,#c9a84c)", backgroundSize: "180% auto", animation: "lx-shine 8s linear infinite" }}
            className="rounded-full px-7 py-3.5 text-sm font-semibold text-white shadow-[0_16px_40px_-12px_rgba(13,53,34,0.5)] transition hover:-translate-y-0.5"
          >
            Request access
          </Link>
          <Link href="/winged-pheasant-golf-links" className="rounded-full bg-white/70 px-7 py-3.5 text-sm font-semibold text-linx-green ring-1 ring-black/5 backdrop-blur transition hover:-translate-y-0.5 hover:bg-white">
            See a live demo →
          </Link>
        </div>
      </section>

      {/* Network / globe */}
      <section id="network" className="relative z-10 mx-auto max-w-5xl scroll-mt-24 px-6 pb-24">
        <div className="rounded-[32px] bg-white/50 p-6 shadow-[0_40px_120px_-50px_rgba(13,53,34,0.5)] ring-1 ring-white/70 backdrop-blur-xl sm:p-10">
          <div className="grid items-center gap-6 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-linx-green/70">Our network</div>
              <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight">
                {pins.length} course{pins.length === 1 ? "" : "s"} and growing.
              </h2>
              <p className="mt-4 max-w-md text-foreground/60">
                Every course on LinxTimes lights up the map. As the network grows, so does the reach
                of your tee sheet — bookings from anyone, anywhere, no account required.
              </p>
              <Link href="/request" className="mt-6 inline-block rounded-full bg-linx-green px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5">
                Add your course
              </Link>
            </div>
            <NetworkGlobe courses={pins} />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative z-10 mx-auto max-w-5xl scroll-mt-24 px-6 pb-24">
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-linx-green/70">How it works</div>
          <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight">Live in three steps.</h2>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {[
            { n: "01", t: "Request", d: "Tell us about your course. Approval takes minutes, not weeks." },
            { n: "02", t: "Onboard", d: "Set your rates, tee times, and brand. Connect Stripe in a click." },
            { n: "03", t: "Go live", d: "Share your page. Golfers book and pay — you get paid automatically." },
          ].map((s) => (
            <div key={s.n} className="group rounded-3xl bg-white/55 p-6 shadow-[0_24px_60px_-40px_rgba(13,53,34,0.5)] ring-1 ring-white/70 backdrop-blur-xl transition hover:-translate-y-1">
              <div className="font-display text-3xl font-semibold text-linx-gold">{s.n}</div>
              <div className="mt-2 font-display text-xl font-semibold">{s.t}</div>
              <p className="mt-2 text-sm text-foreground/60">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-5 sm:grid-cols-2">
          {[
            { t: "No monthly fee", d: "You pay a small per-player fee only when a golfer books online. Never a subscription." },
            { t: "Automatic split payments", d: "Stripe Connect takes the LinxTimes fee and routes the rest straight to your account — instantly." },
            { t: "Fully branded pages", d: "Your logo, your colors, your course. Golfers feel like they're booking with you, not a middleman." },
            { t: "No golfer accounts", d: "Pick a time, pay, done. No sign-up wall means more completed bookings." },
          ].map((f) => (
            <div key={f.t} className="rounded-3xl bg-white/55 p-7 shadow-[0_24px_60px_-40px_rgba(13,53,34,0.5)] ring-1 ring-white/70 backdrop-blur-xl">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-linx-green to-[#1aa37a] text-white">✓</div>
              <div className="font-display text-xl font-semibold">{f.t}</div>
              <p className="mt-2 text-sm text-foreground/60">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonial placeholder */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-24 text-center">
        <div className="rounded-[32px] bg-gradient-to-br from-linx-green to-[#0a2a1b] p-10 text-white shadow-[0_40px_120px_-50px_rgba(13,53,34,0.8)]">
          <p className="font-display text-2xl font-medium leading-snug sm:text-3xl">
            &ldquo;Our members book in seconds and we get paid before they reach the first tee.&rdquo;
          </p>
          <p className="mt-4 text-sm text-white/60">— Head Professional, coming soon</p>
        </div>
      </section>

      {/* CTA footer */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24 text-center">
        <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Ready to modernize your tee sheet?
        </h2>
        <Link href="/request" className="mt-8 inline-block rounded-full bg-linx-green px-8 py-4 text-sm font-semibold text-white shadow-[0_16px_40px_-12px_rgba(13,53,34,0.5)] transition hover:-translate-y-0.5 hover:brightness-110">
          Request access
        </Link>
        <p className="mt-16 text-xs text-foreground/40">© {new Date().getFullYear()} LinxTimes · Powered by Stripe · <Link href="/linxtimes-admin/login" className="text-foreground/20 hover:text-foreground/40 transition">admin</Link></p>
      </section>
    </main>
  );
}

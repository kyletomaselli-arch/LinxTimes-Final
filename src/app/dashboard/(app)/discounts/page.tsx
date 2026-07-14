import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { toDateKey } from "@/lib/datetime";
import { formatCentsCompact } from "@/lib/money";
import { CreatePromoForm, RainCheckForm } from "./DiscountForms";
import { togglePromo, deletePromo, voidRainCheck } from "./actions";

export default async function DiscountsPage() {
  const { course } = await requireCourseAdmin();
  const [codes, rainChecks] = await Promise.all([
    prisma.promoCode.findMany({ where: { courseId: course.id }, orderBy: { createdAt: "desc" } }),
    prisma.rainCheck.findMany({ where: { courseId: course.id }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-display text-3xl font-semibold text-foreground">Discount codes</h1>
      <p className="mt-1 text-sm text-foreground/55">
        Create codes golfers enter at booking for a discount off green + cart. The discount is
        funded by your course; the LinxTimes fee and tax are unaffected.
      </p>

      <div className="mt-5 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">New code</h2>
        <CreatePromoForm />
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)]">
        {codes.length === 0 ? (
          <div className="py-14 text-center text-sm text-foreground/50">No discount codes yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs uppercase tracking-wide text-foreground/45">
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Discount</th>
                <th className="px-4 py-3 font-semibold">Used</th>
                <th className="px-4 py-3 font-semibold">Expires</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id} className="border-b border-black/[0.04] last:border-0">
                  <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
                  <td className="px-4 py-3">{c.kind === "percent" ? `${c.value}% off` : `${formatCentsCompact(c.value)} off`}</td>
                  <td className="px-4 py-3 text-foreground/70">{c.timesRedeemed}{c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}</td>
                  <td className="px-4 py-3 text-foreground/70">{c.expiresAt ? toDateKey(c.expiresAt) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${c.isActive ? "bg-green-100 text-green-800" : "bg-black/[0.06] text-foreground/50"}`}>
                      {c.isActive ? "Active" : "Off"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <form action={togglePromo}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-foreground/70 hover:bg-black/[0.04]">{c.isActive ? "Turn off" : "Turn on"}</button>
                      </form>
                      <form action={deletePromo}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h1 className="mt-10 font-display text-3xl font-semibold text-foreground">Rain checks</h1>
      <p className="mt-1 text-sm text-foreground/55">
        Issue a credit (e.g. for a rained-out round). You&apos;ll get a code to give the golfer; they
        redeem it at checkout. Single use.
      </p>

      <div className="mt-5 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">Issue a rain check</h2>
        <RainCheckForm />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)]">
        {rainChecks.length === 0 ? (
          <div className="py-14 text-center text-sm text-foreground/50">No rain checks issued yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs uppercase tracking-wide text-foreground/45">
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Issued to</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rainChecks.map((rc) => (
                <tr key={rc.id} className="border-b border-black/[0.04] last:border-0">
                  <td className="px-4 py-3 font-mono font-semibold">{rc.code}</td>
                  <td className="px-4 py-3">{formatCentsCompact(rc.amountCents)}</td>
                  <td className="px-4 py-3 text-foreground/70">{rc.note ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${rc.redeemedAt ? "bg-black/[0.06] text-foreground/50" : rc.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
                      {rc.redeemedAt ? "Redeemed" : rc.isActive ? "Active" : "Voided"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!rc.redeemedAt && rc.isActive && (
                      <form action={voidRainCheck}>
                        <input type="hidden" name="id" value={rc.id} />
                        <button className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Void</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

import { requireSuperAdmin } from "@/lib/super-session";
import { prisma } from "@/lib/prisma";
import { RequestActions } from "../_components/RequestActions";

export default async function RequestsPage() {
  await requireSuperAdmin();
  const requests = await prisma.onboardingRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const pending = requests.filter((r) => !r.courseId && !r.reviewedAt);
  const reviewed = requests.filter((r) => r.courseId || r.reviewedAt);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl font-semibold text-foreground">Access requests</h1>
      <p className="mt-1 text-sm text-foreground/55">{pending.length} awaiting review.</p>

      <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)]">
        {pending.length === 0 ? (
          <div className="py-12 text-center text-sm text-foreground/50">No pending requests.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {pending.map((r) => (
                <tr key={r.id} className="border-b border-black/[0.04] last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.courseName}</div>
                    <div className="text-xs text-foreground/50">{r.ownerName} · {r.email}{r.city ? ` · ${r.city}, ${r.state ?? ""}` : ""}</div>
                    {r.estimatedRounds ? <div className="text-xs text-foreground/40">~{r.estimatedRounds.toLocaleString()} rounds/yr</div> : null}
                  </td>
                  <td className="px-4 py-3 text-right"><RequestActions requestId={r.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {reviewed.length > 0 && (
        <>
          <h2 className="mt-8 font-display text-lg font-semibold text-foreground">Reviewed</h2>
          <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)]">
            <table className="w-full text-sm">
              <tbody>
                {reviewed.map((r) => (
                  <tr key={r.id} className="border-b border-black/[0.04] last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.courseName}</div>
                      <div className="text-xs text-foreground/50">{r.email}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.courseId ? (
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">Approved</span>
                      ) : (
                        <span className="rounded-full bg-black/[0.06] px-2.5 py-0.5 text-xs font-medium text-foreground/50" title={r.declineReason ?? ""}>Declined</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

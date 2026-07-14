import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCentsCompact } from "@/lib/money";
import { ShopForm } from "./ShopForm";
import { toggleShopItem, deleteShopItem } from "./actions";

export default async function ShopPage() {
  const { course } = await requireCourseAdmin();
  const items = await prisma.shopItem.findMany({
    where: { courseId: course.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-semibold text-foreground">Pro shop items</h1>
      <p className="mt-1 text-sm text-foreground/55">
        Items you sell at the counter (rentals, range balls, merch). When collecting a payment on the
        tee sheet, staff tap these to add them to the charge — tax is applied automatically.
      </p>

      <div className="mt-5 rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)] p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">New item</h2>
        <ShopForm />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-[0_18px_40px_-34px_rgba(16,50,34,0.4)]">
        {items.length === 0 ? (
          <div className="py-14 text-center text-sm text-foreground/50">No items yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs uppercase tracking-wide text-foreground/45">
                <th className="px-4 py-3 font-semibold">Item</th>
                <th className="px-4 py-3 font-semibold">Price</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-black/[0.04] last:border-0">
                  <td className="px-4 py-3 font-medium">{it.name}</td>
                  <td className="px-4 py-3">{formatCentsCompact(it.priceCents)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${it.isActive ? "bg-green-100 text-green-800" : "bg-black/[0.06] text-foreground/50"}`}>
                      {it.isActive ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <form action={toggleShopItem}>
                        <input type="hidden" name="id" value={it.id} />
                        <button className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-foreground/70 hover:bg-black/[0.04]">{it.isActive ? "Hide" : "Show"}</button>
                      </form>
                      <form action={deleteShopItem}>
                        <input type="hidden" name="id" value={it.id} />
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
    </div>
  );
}

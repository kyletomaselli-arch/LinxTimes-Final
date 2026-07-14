"use server";

import { revalidatePath } from "next/cache";
import { requireCourseAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export interface ShopResult {
  ok: boolean;
  message: string;
}

/** Add a pro-shop item (name + price) to the course's counter catalog. */
export async function createShopItem(_prev: ShopResult, formData: FormData): Promise<ShopResult> {
  const { course } = await requireCourseAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const dollars = Number(String(formData.get("price") ?? "").trim());
  if (!name || name.length > 60) return { ok: false, message: "Enter an item name (max 60 chars)." };
  if (!Number.isFinite(dollars) || dollars < 0) return { ok: false, message: "Enter a valid price." };

  await prisma.shopItem.create({
    data: { courseId: course.id, name, priceCents: Math.round(dollars * 100) },
  });
  revalidatePath("/dashboard/shop");
  return { ok: true, message: `Added ${name}.` };
}

export async function toggleShopItem(formData: FormData): Promise<void> {
  const { course } = await requireCourseAdmin();
  const id = String(formData.get("id") ?? "");
  const it = await prisma.shopItem.findFirst({ where: { id, courseId: course.id } });
  if (!it) return;
  await prisma.shopItem.update({ where: { id }, data: { isActive: !it.isActive } });
  revalidatePath("/dashboard/shop");
}

export async function deleteShopItem(formData: FormData): Promise<void> {
  const { course } = await requireCourseAdmin();
  const id = String(formData.get("id") ?? "");
  const it = await prisma.shopItem.findFirst({ where: { id, courseId: course.id } });
  if (!it) return;
  await prisma.shopItem.delete({ where: { id } });
  revalidatePath("/dashboard/shop");
}

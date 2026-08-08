import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { requireCourseAdmin } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const { course } = await requireCourseAdmin();
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!file.type.startsWith("image/")) return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });

    const filename = `${course.id}/${Date.now()}-${file.name}`;
    const blob = await put(filename, file, { access: "public" });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

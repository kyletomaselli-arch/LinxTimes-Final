import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const b64 = (i: Buffer|string) => Buffer.from(i).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
async function main() {
  const c = await prisma.course.findUnique({ where: { slug: "winged-pheasant-golf-links" } });
  const staff = await prisma.courseAdmin.upsert({
    where: { email: "staff@wingedpheasant.example.com" },
    update: { role: "staff" },
    create: { courseId: c!.id, email: "staff@wingedpheasant.example.com", name: "Front Desk", role: "staff", passwordHash: await bcrypt.hash("staff1234!", 12) },
  });
  const body = { adminId: staff.id, courseId: c!.id, kind: "course_admin", exp: Math.floor(Date.now()/1000)+28800 };
  const data = b64(JSON.stringify(body));
  const sig = crypto.createHmac("sha256", process.env.JWT_SECRET!).update(data).digest();
  console.log(`${data}.${b64(sig)}`);
}
main().finally(() => prisma.$disconnect());

import "dotenv/config";
import crypto from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function main() {
  const admin = await prisma.courseAdmin.findUnique({
    where: { email: "pro@wingedpheasant.example.com" },
  });
  if (!admin) throw new Error("seed admin not found");

  const body = {
    adminId: admin.id,
    courseId: admin.courseId,
    kind: "course_admin",
    exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
  };
  const data = b64url(JSON.stringify(body));
  const sig = crypto.createHmac("sha256", process.env.JWT_SECRET!).update(data).digest();
  console.log(`${data}.${b64url(sig)}`);
}

main().finally(() => prisma.$disconnect());

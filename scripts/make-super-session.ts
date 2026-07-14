import "dotenv/config";
import crypto from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const b64 = (i: Buffer | string) => Buffer.from(i).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
async function main() {
  const a = await prisma.superAdmin.findUnique({ where: { email: "admin@linxtimes.com" } });
  if (!a) throw new Error("no super admin");
  const body = { adminId: a.id, kind: "super_admin", exp: Math.floor(Date.now()/1000)+28800 };
  const data = b64(JSON.stringify(body));
  const sig = crypto.createHmac("sha256", process.env.JWT_SECRET!).update(data).digest();
  console.log(`${data}.${b64(sig)}`);
}
main().finally(() => prisma.$disconnect());

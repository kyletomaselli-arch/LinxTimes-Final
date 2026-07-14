/*
  Warnings:

  - You are about to drop the column `membershipPaymentId` on the `members` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_membershipTierId_fkey";

-- DropForeignKey
ALTER TABLE "membership_tiers" DROP CONSTRAINT "membership_tiers_courseId_fkey";

-- AlterTable
ALTER TABLE "members" DROP COLUMN "membershipPaymentId";

-- AddForeignKey
ALTER TABLE "membership_tiers" ADD CONSTRAINT "membership_tiers_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_membershipTierId_fkey" FOREIGN KEY ("membershipTierId") REFERENCES "membership_tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

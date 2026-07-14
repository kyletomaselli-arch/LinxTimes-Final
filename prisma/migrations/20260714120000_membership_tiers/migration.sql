-- CreateTable MembershipTier
CREATE TABLE "membership_tiers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "membership_tiers_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses" ("id") ON DELETE CASCADE
);

-- Add membershipTierId to Member
ALTER TABLE "members" ADD COLUMN "membershipTierId" TEXT;
ALTER TABLE "members" ADD CONSTRAINT "members_membershipTierId_fkey" FOREIGN KEY ("membershipTierId") REFERENCES "membership_tiers" ("id") ON DELETE SET NULL;

-- Add membershipPaymentId to Member to track when they joined/paid
ALTER TABLE "members" ADD COLUMN "membershipPaymentId" TEXT;
ALTER TABLE "members" ADD COLUMN "membershipPaidAt" TIMESTAMP(3);

-- CreateIndex MembershipTier
CREATE UNIQUE INDEX "membership_tiers_courseId_name_key" ON "membership_tiers"("courseId", "name");

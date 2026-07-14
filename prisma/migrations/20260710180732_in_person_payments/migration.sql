-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('terminal', 'cash', 'other');

-- CreateEnum
CREATE TYPE "PaymentState" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'partially_paid';
ALTER TYPE "PaymentStatus" ADD VALUE 'paid_in_person';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "amountPaidCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "stripeTerminalReaderId" TEXT;

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "playersCovered" INTEGER NOT NULL DEFAULT 0,
    "method" "PaymentMethod" NOT NULL DEFAULT 'terminal',
    "state" "PaymentState" NOT NULL DEFAULT 'pending',
    "stripePaymentIntentId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_bookingId_idx" ON "payments"("bookingId");

-- CreateIndex
CREATE INDEX "payments_courseId_idx" ON "payments"("courseId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

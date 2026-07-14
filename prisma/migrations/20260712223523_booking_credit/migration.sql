-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "creditCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rainCheckCode" TEXT;

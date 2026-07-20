-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "description" TEXT,
ADD COLUMN     "metadata" JSONB,
ALTER COLUMN "bookingId" DROP NOT NULL;

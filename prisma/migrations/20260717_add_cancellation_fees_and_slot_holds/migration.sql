-- Add cancellation fee configuration to courses
ALTER TABLE "courses" ADD COLUMN "cancellationFeeBps" INTEGER NOT NULL DEFAULT 0;

-- Add slot hold tracking to bookings (when payment form is opened, hold until payment succeeds or expires)
ALTER TABLE "bookings" ADD COLUMN "slotHeldUntil" TIMESTAMP(3);

-- Index for efficient cleanup of expired slot holds
CREATE INDEX "bookings_slotHeldUntil_idx" ON "bookings"("slotHeldUntil");

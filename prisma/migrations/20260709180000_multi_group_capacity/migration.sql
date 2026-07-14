-- DropIndex
DROP INDEX "bookings_layoutId_bookingDate_slotTime_key";

-- CreateIndex
CREATE INDEX "bookings_layoutId_bookingDate_slotTime_idx" ON "bookings"("layoutId", "bookingDate", "slotTime");

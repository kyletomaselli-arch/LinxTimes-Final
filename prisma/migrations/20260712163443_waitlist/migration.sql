-- CreateTable
CREATE TABLE "waitlist" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "bookingDate" DATE NOT NULL,
    "slotTime" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "numPlayers" INTEGER NOT NULL DEFAULT 1,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "waitlist_courseId_layoutId_bookingDate_slotTime_idx" ON "waitlist"("courseId", "layoutId", "bookingDate", "slotTime");

-- AddForeignKey
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "layouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

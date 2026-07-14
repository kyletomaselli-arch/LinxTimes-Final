-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('pending', 'approved', 'active', 'suspended');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('confirmed', 'checked_in', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'paid_online', 'pay_at_course', 'refunded');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('online', 'walkin', 'phone');

-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('weekday', 'weekend', 'twilight', 'member');

-- CreateEnum
CREATE TYPE "DiscountDays" AS ENUM ('all', 'mon_thu');

-- CreateEnum
CREATE TYPE "MembershipType" AS ENUM ('full', 'associate', 'junior', 'senior', 'social');

-- CreateTable
CREATE TABLE "super_admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "email" TEXT,
    "logoUrl" TEXT,
    "heroImageUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#0D3522',
    "secondaryColor" TEXT DEFAULT '#C9A84C',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "stripeAccountId" TEXT,
    "stripeOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "status" "CourseStatus" NOT NULL DEFAULT 'pending',
    "linxtimesFee" INTEGER NOT NULL DEFAULT 100,
    "notificationEmail" TEXT,
    "payAtCourseEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maxDaysAhead" INTEGER NOT NULL DEFAULT 14,
    "bookingIntervalMin" INTEGER NOT NULL DEFAULT 10,
    "onboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_admins" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "layouts" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "holes" INTEGER NOT NULL DEFAULT 18,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "layouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tee_time_slots" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "intervalMin" INTEGER NOT NULL DEFAULT 10,
    "maxPlayers" INTEGER NOT NULL DEFAULT 4,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tee_time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_overrides" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "overrideDate" DATE NOT NULL,
    "slotTime" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT true,
    "maxPlayers" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "weekdayFee" INTEGER NOT NULL DEFAULT 5000,
    "weekendFee" INTEGER NOT NULL DEFAULT 7000,
    "twilightFee" INTEGER NOT NULL DEFAULT 3000,
    "twilightHour" INTEGER NOT NULL DEFAULT 16,
    "memberFee" INTEGER NOT NULL DEFAULT 2500,
    "cartFee" INTEGER NOT NULL DEFAULT 1500,
    "cartAvailable" BOOLEAN NOT NULL DEFAULT true,
    "nineHoleDiscount" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "membershipType" "MembershipType" NOT NULL DEFAULT 'full',
    "greenFeeOverride" INTEGER,
    "cartIncluded" BOOLEAN NOT NULL DEFAULT false,
    "discountDays" "DiscountDays" NOT NULL DEFAULT 'all',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "confirmationNo" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "memberId" TEXT,
    "bookingDate" DATE NOT NULL,
    "slotTime" TEXT NOT NULL,
    "numPlayers" INTEGER NOT NULL,
    "withCart" BOOLEAN NOT NULL DEFAULT false,
    "holes" INTEGER NOT NULL DEFAULT 18,
    "golferName" TEXT NOT NULL,
    "golferEmail" TEXT NOT NULL,
    "golferPhone" TEXT,
    "rateType" "RateType" NOT NULL DEFAULT 'weekday',
    "greenFeeCents" INTEGER NOT NULL,
    "cartFeeCents" INTEGER NOT NULL DEFAULT 0,
    "bookingFeeCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
    "stripePaymentIntentId" TEXT,
    "stripeTransferId" TEXT,
    "stripeChargeId" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'confirmed',
    "source" "BookingSource" NOT NULL DEFAULT 'online',
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancellationReason" TEXT,
    "cancellationOverride" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_requests" (
    "id" TEXT NOT NULL,
    "courseId" TEXT,
    "ownerName" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "estimatedRounds" INTEGER,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "message" TEXT,
    "status" "CourseStatus" NOT NULL DEFAULT 'pending',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_tokens" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_email_key" ON "super_admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "course_admins_email_key" ON "course_admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tee_time_slots_layoutId_dayOfWeek_key" ON "tee_time_slots"("layoutId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_layoutId_key" ON "pricing"("layoutId");

-- CreateIndex
CREATE UNIQUE INDEX "members_courseId_memberId_key" ON "members"("courseId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_confirmationNo_key" ON "bookings"("confirmationNo");

-- CreateIndex
CREATE INDEX "bookings_courseId_bookingDate_idx" ON "bookings"("courseId", "bookingDate");

-- CreateIndex
CREATE INDEX "bookings_golferEmail_idx" ON "bookings"("golferEmail");

-- CreateIndex
CREATE INDEX "bookings_confirmationNo_idx" ON "bookings"("confirmationNo");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_layoutId_bookingDate_slotTime_key" ON "bookings"("layoutId", "bookingDate", "slotTime");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_tokens_token_key" ON "onboarding_tokens"("token");

-- AddForeignKey
ALTER TABLE "course_admins" ADD CONSTRAINT "course_admins_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layouts" ADD CONSTRAINT "layouts_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tee_time_slots" ADD CONSTRAINT "tee_time_slots_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "layouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_overrides" ADD CONSTRAINT "daily_overrides_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing" ADD CONSTRAINT "pricing_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "layouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "layouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

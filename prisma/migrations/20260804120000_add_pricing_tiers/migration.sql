-- CreateTable pricing_tiers
CREATE TABLE "pricing_tiers" (
    "id" TEXT NOT NULL,
    "pricingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startHour" SMALLINT NOT NULL,
    "endHour" SMALLINT NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "applyTo" TEXT NOT NULL DEFAULT 'both',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pricing_tiers_pricingId_idx" ON "pricing_tiers"("pricingId");

-- AddForeignKey
ALTER TABLE "pricing_tiers" ADD CONSTRAINT "pricing_tiers_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "pricing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

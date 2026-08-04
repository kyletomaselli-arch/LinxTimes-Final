-- Add missing twilightEnabled column to pricing table
ALTER TABLE "pricing" ADD COLUMN "twilightEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateEnum
CREATE TYPE "CourseRole" AS ENUM ('owner', 'manager', 'staff');

-- AlterTable
ALTER TABLE "course_admins" ADD COLUMN     "role" "CourseRole" NOT NULL DEFAULT 'owner';

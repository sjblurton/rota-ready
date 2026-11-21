-- CreateEnum
CREATE TYPE "shift_response" AS ENUM ('pending', 'confirmed', 'declined');

-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "decline_reason" TEXT,
ADD COLUMN     "responded_at" TIMESTAMPTZ,
ADD COLUMN     "response" "shift_response" NOT NULL DEFAULT 'pending';

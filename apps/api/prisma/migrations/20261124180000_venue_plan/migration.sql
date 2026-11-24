BEGIN;
SET LOCAL lock_timeout = '5s';

-- CreateEnum
CREATE TYPE "plan" AS ENUM ('free', 'pro');

-- AlterTable
ALTER TABLE "venues" ADD COLUMN "plan" "plan" NOT NULL DEFAULT 'free';

COMMIT;

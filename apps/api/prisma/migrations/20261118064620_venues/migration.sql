-- CreateEnum
CREATE TYPE "member_role" AS ENUM ('owner');

-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "time_zone" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_members" (
    "user_id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "role" "member_role" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venue_members_pkey" PRIMARY KEY ("user_id","venue_id")
);

-- CreateIndex
CREATE INDEX "venue_members_venue_id_idx" ON "venue_members"("venue_id");

-- AddForeignKey
ALTER TABLE "venue_members" ADD CONSTRAINT "venue_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_members" ADD CONSTRAINT "venue_members_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

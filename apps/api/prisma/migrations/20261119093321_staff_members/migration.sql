-- CreateTable
CREATE TABLE "staff_members" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "staff_members_venue_id_idx" ON "staff_members"("venue_id");

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

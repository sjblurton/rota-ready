-- CreateTable
CREATE TABLE "staff_members" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_venue_id_email_key" ON "staff_members"("venue_id", "email");

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_email_iff_active" CHECK (("archived_at" IS NULL) = ("email" IS NOT NULL));

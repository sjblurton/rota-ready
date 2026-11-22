-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "deleted_at" TIMESTAMPTZ,
ADD COLUMN     "told_ends_at" TIMESTAMPTZ,
ADD COLUMN     "told_staff_member_id" UUID,
ADD COLUMN     "told_starts_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "shifts_told_staff_member_id_told_starts_at_idx" ON "shifts"("told_staff_member_id", "told_starts_at");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_told_staff_member_id_fkey" FOREIGN KEY ("told_staff_member_id") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Shifts in Rotas published before this migration were told as they are now.
UPDATE "shifts" SET "told_staff_member_id" = "staff_member_id", "told_starts_at" = "starts_at", "told_ends_at" = "ends_at"
WHERE "rota_id" IN (SELECT "id" FROM "rotas" WHERE "status" = 'published');

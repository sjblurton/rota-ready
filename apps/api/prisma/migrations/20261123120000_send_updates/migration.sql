-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "previous_ends_at" TIMESTAMPTZ,
ADD COLUMN     "previous_staff_member_id" UUID,
ADD COLUMN     "previous_starts_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "shift_removals" (
    "id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "staff_member_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_removals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shift_removals_staff_member_id_starts_at_idx" ON "shift_removals"("staff_member_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "shift_removals_shift_id_staff_member_id_key" ON "shift_removals"("shift_id", "staff_member_id");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_previous_staff_member_id_fkey" FOREIGN KEY ("previous_staff_member_id") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_removals" ADD CONSTRAINT "shift_removals_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_removals" ADD CONSTRAINT "shift_removals_staff_member_id_fkey" FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


BEGIN;
SET LOCAL lock_timeout = '5s';

DROP TRIGGER "shifts_copy_told_to_notified" ON "shifts";

-- squawk-ignore ban-drop-function
DROP FUNCTION private.copy_told_to_notified();

-- squawk-ignore ban-drop-constraint
ALTER TABLE "shifts" DROP CONSTRAINT "shifts_told_snapshot_complete";

-- DropForeignKey
-- squawk-ignore ban-drop-constraint
ALTER TABLE "shifts" DROP CONSTRAINT "shifts_told_staff_member_id_fkey";

-- DropIndex
-- squawk-ignore require-concurrent-index-deletion
DROP INDEX "shifts_told_staff_member_id_told_starts_at_idx";

-- AlterTable
-- squawk-ignore ban-drop-column
ALTER TABLE "shifts" DROP COLUMN "told_ends_at";
-- squawk-ignore ban-drop-column
ALTER TABLE "shifts" DROP COLUMN "told_staff_member_id";
-- squawk-ignore ban-drop-column
ALTER TABLE "shifts" DROP COLUMN "told_starts_at";

COMMIT;

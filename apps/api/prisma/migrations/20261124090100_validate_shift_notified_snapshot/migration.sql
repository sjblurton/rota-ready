BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "shifts" VALIDATE CONSTRAINT "shifts_notified_staff_member_id_fkey";
ALTER TABLE "shifts" VALIDATE CONSTRAINT "shifts_notified_snapshot_complete";

COMMIT;

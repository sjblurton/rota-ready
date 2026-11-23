BEGIN;
SET LOCAL lock_timeout = '5s';

-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "notified_ends_at" TIMESTAMPTZ,
ADD COLUMN     "notified_staff_member_id" UUID,
ADD COLUMN     "notified_starts_at" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "shifts_notified_staff_member_id_notified_starts_at_idx" ON "shifts"("notified_staff_member_id", "notified_starts_at");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_notified_staff_member_id_fkey" FOREIGN KEY ("notified_staff_member_id") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

-- AddCheckConstraint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_notified_snapshot_complete" CHECK (num_nulls("notified_staff_member_id", "notified_starts_at", "notified_ends_at") IN (0, 3)) NOT VALID;

UPDATE "shifts" SET "notified_staff_member_id" = "told_staff_member_id", "notified_starts_at" = "told_starts_at", "notified_ends_at" = "told_ends_at"
WHERE "told_staff_member_id" IS NOT NULL;

CREATE FUNCTION private.copy_told_to_notified()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF num_nulls(NEW.told_staff_member_id, NEW.told_starts_at, NEW.told_ends_at) NOT IN (0, 3) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF num_nulls(NEW.told_staff_member_id, NEW.told_starts_at, NEW.told_ends_at) = 3 THEN
      RETURN NEW;
    END IF;
  ELSIF (NEW.told_staff_member_id, NEW.told_starts_at, NEW.told_ends_at)
    IS NOT DISTINCT FROM (OLD.told_staff_member_id, OLD.told_starts_at, OLD.told_ends_at) THEN
    RETURN NEW;
  END IF;
  NEW.notified_staff_member_id := NEW.told_staff_member_id;
  NEW.notified_starts_at := NEW.told_starts_at;
  NEW.notified_ends_at := NEW.told_ends_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "shifts_copy_told_to_notified"
  BEFORE INSERT OR UPDATE OF "told_staff_member_id", "told_starts_at", "told_ends_at" ON "shifts"
  FOR EACH ROW
  EXECUTE FUNCTION private.copy_told_to_notified();

COMMIT;

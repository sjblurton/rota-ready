BEGIN;
SET LOCAL lock_timeout = '5s';

-- AlterEnum
ALTER TYPE "plan" ADD VALUE 'preview' AFTER 'pro';

COMMIT;

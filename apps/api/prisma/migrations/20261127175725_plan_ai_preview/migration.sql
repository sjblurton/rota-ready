BEGIN;
SET LOCAL lock_timeout = '5s';

-- AlterEnum
ALTER TYPE "plan" ADD VALUE 'ai_preview' AFTER 'pro';

COMMIT;

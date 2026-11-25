-- Runs are now only PASSED, FAILED or ERROR, and checks no longer have a severity.

-- Any run that ended WARNING had a failing check, so it becomes FAILED.
UPDATE "CheckRun" SET "status" = 'FAILED' WHERE "status" = 'WARNING';

-- AlterEnum
BEGIN;
CREATE TYPE "RunStatus_new" AS ENUM ('QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'ERROR');
ALTER TABLE "public"."CheckRun" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CheckRun" ALTER COLUMN "status" TYPE "RunStatus_new" USING ("status"::text::"RunStatus_new");
ALTER TYPE "RunStatus" RENAME TO "RunStatus_old";
ALTER TYPE "RunStatus_new" RENAME TO "RunStatus";
DROP TYPE "public"."RunStatus_old";
ALTER TABLE "CheckRun" ALTER COLUMN "status" SET DEFAULT 'QUEUED';
COMMIT;

-- AlterTable
ALTER TABLE "Check" DROP COLUMN "severity";

-- DropEnum
DROP TYPE "Severity";

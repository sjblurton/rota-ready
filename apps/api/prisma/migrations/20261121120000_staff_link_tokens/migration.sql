-- AlterTable
ALTER TABLE "staff_members" ADD COLUMN "staff_link_token_hash" TEXT,
ADD COLUMN "staff_link_token_ciphertext" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_staff_link_token_hash_key" ON "staff_members"("staff_link_token_hash");

-- AddCheckConstraint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_staff_link_token_complete" CHECK (("staff_link_token_hash" IS NULL) = ("staff_link_token_ciphertext" IS NULL));

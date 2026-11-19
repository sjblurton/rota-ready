-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "rota_id" UUID NOT NULL,
    "staff_member_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shifts_rota_id_starts_at_idx" ON "shifts"("rota_id", "starts_at");

-- CreateIndex
CREATE INDEX "shifts_staff_member_id_starts_at_idx" ON "shifts"("staff_member_id", "starts_at");

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_rota_id_fkey" FOREIGN KEY ("rota_id") REFERENCES "rotas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_staff_member_id_fkey" FOREIGN KEY ("staff_member_id") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_length" CHECK ("ends_at" > "starts_at" AND "ends_at" - "starts_at" <= INTERVAL '16 hours');

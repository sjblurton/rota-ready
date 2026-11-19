-- CreateEnum
CREATE TYPE "rota_status" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "rotas" (
    "id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "status" "rota_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rotas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rotas_venue_id_week_start_key" ON "rotas"("venue_id", "week_start");

-- AddForeignKey
ALTER TABLE "rotas" ADD CONSTRAINT "rotas_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

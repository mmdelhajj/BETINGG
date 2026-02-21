-- AlterTable
ALTER TABLE "competitions" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "logo" TEXT;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "awayTeamLogo" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "homeTeamLogo" TEXT;

-- CreateIndex
CREATE INDEX "competitions_externalId_idx" ON "competitions"("externalId");

-- CreateIndex
CREATE INDEX "events_externalId_idx" ON "events"("externalId");

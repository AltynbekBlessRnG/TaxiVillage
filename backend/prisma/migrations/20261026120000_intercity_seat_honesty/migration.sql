-- CreateEnum
CREATE TYPE "IntercityBookingCancelSource" AS ENUM ('PASSENGER', 'DRIVER', 'TRIP_CANCELED');

-- DropIndex
DROP INDEX "IntercityBooking_tripId_passengerId_status_key";

-- AlterTable
ALTER TABLE "IntercityBooking" ADD COLUMN     "canceledAt" TIMESTAMP(3),
ADD COLUMN     "canceledBy" "IntercityBookingCancelSource";

-- AlterTable
ALTER TABLE "IntercityTrip" ADD COLUMN     "offlineSeats" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "IntercityBooking_tripId_passengerId_idx" ON "IntercityBooking"("tripId", "passengerId");

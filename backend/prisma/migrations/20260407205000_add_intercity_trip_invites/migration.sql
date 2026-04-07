-- CreateEnum
CREATE TYPE "IntercityTripInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED');

-- CreateTable
CREATE TABLE "IntercityTripInvite" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "tripId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "IntercityTripInviteStatus" NOT NULL DEFAULT 'PENDING',
    "seatsOffered" INTEGER NOT NULL DEFAULT 1,
    "priceOffered" DECIMAL(10,2) NOT NULL,
    "message" TEXT,

    CONSTRAINT "IntercityTripInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntercityTripInvite_tripId_status_idx" ON "IntercityTripInvite"("tripId", "status");

-- CreateIndex
CREATE INDEX "IntercityTripInvite_orderId_status_idx" ON "IntercityTripInvite"("orderId", "status");

-- AddForeignKey
ALTER TABLE "IntercityTripInvite" ADD CONSTRAINT "IntercityTripInvite_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "IntercityTrip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntercityTripInvite" ADD CONSTRAINT "IntercityTripInvite_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "IntercityOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

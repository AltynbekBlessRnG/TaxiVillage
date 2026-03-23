-- CreateEnum
CREATE TYPE "DriverMode" AS ENUM ('TAXI', 'INTERCITY');

-- CreateEnum
CREATE TYPE "IntercityTripStatus" AS ENUM ('PLANNED', 'BOARDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "IntercityBookingStatus" AS ENUM ('CONFIRMED', 'BOARDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "IntercityBookingType" AS ENUM ('SEAT', 'FULL_CABIN');

-- AlterTable
ALTER TABLE "DriverProfile" ADD COLUMN     "driverMode" "DriverMode" NOT NULL DEFAULT 'TAXI',
ADD COLUMN     "supportsIntercity" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supportsTaxi" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "IntercityTrip" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "driverId" TEXT NOT NULL,
    "fromCity" TEXT NOT NULL,
    "toCity" TEXT NOT NULL,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "pricePerSeat" DECIMAL(10,2) NOT NULL,
    "seatCapacity" INTEGER NOT NULL,
    "comment" TEXT,
    "carMake" TEXT,
    "carModel" TEXT,
    "carColor" TEXT,
    "plateNumber" TEXT,
    "status" "IntercityTripStatus" NOT NULL DEFAULT 'PLANNED',

    CONSTRAINT "IntercityTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntercityBooking" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tripId" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "bookingType" "IntercityBookingType" NOT NULL DEFAULT 'SEAT',
    "seatsBooked" INTEGER NOT NULL DEFAULT 1,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "comment" TEXT,
    "status" "IntercityBookingStatus" NOT NULL DEFAULT 'CONFIRMED',

    CONSTRAINT "IntercityBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntercityTripStatusHistory" (
    "id" TEXT NOT NULL,
    "intercityTripId" TEXT NOT NULL,
    "status" "IntercityTripStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntercityTripStatusHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "IntercityTrip" ADD CONSTRAINT "IntercityTrip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntercityBooking" ADD CONSTRAINT "IntercityBooking_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "IntercityTrip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntercityBooking" ADD CONSTRAINT "IntercityBooking_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "PassengerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntercityTripStatusHistory" ADD CONSTRAINT "IntercityTripStatusHistory_intercityTripId_fkey" FOREIGN KEY ("intercityTripId") REFERENCES "IntercityTrip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

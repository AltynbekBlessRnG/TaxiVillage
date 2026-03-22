-- CreateEnum
CREATE TYPE "CourierOrderStatus" AS ENUM ('SEARCHING_COURIER', 'TO_PICKUP', 'PICKED_UP', 'DELIVERING', 'DELIVERED', 'CANCELED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'COURIER';
ALTER TYPE "UserRole" ADD VALUE 'DRIVER_INTERCITY';
ALTER TYPE "UserRole" ADD VALUE 'MERCHANT';

-- CreateTable
CREATE TABLE "CourierProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT,
    "status" "DriverStatus" NOT NULL DEFAULT 'APPROVED',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "lastOrderFinishedAt" TIMESTAMP(3),
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,

    CONSTRAINT "CourierProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierOrder" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "passengerId" TEXT NOT NULL,
    "courierId" TEXT,
    "status" "CourierOrderStatus" NOT NULL DEFAULT 'SEARCHING_COURIER',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CARD',
    "pickupAddress" TEXT NOT NULL,
    "pickupLat" DOUBLE PRECISION NOT NULL,
    "pickupLng" DOUBLE PRECISION NOT NULL,
    "dropoffAddress" TEXT NOT NULL,
    "dropoffLat" DOUBLE PRECISION NOT NULL,
    "dropoffLng" DOUBLE PRECISION NOT NULL,
    "itemDescription" TEXT NOT NULL,
    "packageWeight" TEXT,
    "packageSize" TEXT,
    "comment" TEXT,
    "estimatedPrice" DECIMAL(10,2),
    "finalPrice" DECIMAL(10,2),
    "pickedUpAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "CourierOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourierOrderStatusHistory" (
    "id" TEXT NOT NULL,
    "courierOrderId" TEXT NOT NULL,
    "status" "CourierOrderStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourierOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourierProfile_userId_key" ON "CourierProfile"("userId");

-- AddForeignKey
ALTER TABLE "CourierProfile" ADD CONSTRAINT "CourierProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierOrder" ADD CONSTRAINT "CourierOrder_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "PassengerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierOrder" ADD CONSTRAINT "CourierOrder_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "CourierProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourierOrderStatusHistory" ADD CONSTRAINT "CourierOrderStatusHistory_courierOrderId_fkey" FOREIGN KEY ("courierOrderId") REFERENCES "CourierOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

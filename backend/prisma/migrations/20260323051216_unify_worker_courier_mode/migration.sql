-- CreateEnum
CREATE TYPE "CourierTransportType" AS ENUM ('CAR', 'BIKE', 'FOOT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CourierOrderStatus" ADD VALUE 'COURIER_ARRIVED';
ALTER TYPE "CourierOrderStatus" ADD VALUE 'TO_RECIPIENT';

-- AlterEnum
ALTER TYPE "DriverMode" ADD VALUE 'COURIER';

-- AlterTable
ALTER TABLE "CourierOrder" ADD COLUMN     "arrivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DriverProfile" ADD COLUMN     "courierTransportType" "CourierTransportType",
ADD COLUMN     "supportsCourier" BOOLEAN NOT NULL DEFAULT false;

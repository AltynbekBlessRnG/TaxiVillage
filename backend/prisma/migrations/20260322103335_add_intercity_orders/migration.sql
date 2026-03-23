-- CreateEnum
CREATE TYPE "IntercityOrderStatus" AS ENUM ('SEARCHING_DRIVER', 'CONFIRMED', 'DRIVER_EN_ROUTE', 'BOARDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateTable
CREATE TABLE "IntercityDriverProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT,
    "status" "DriverStatus" NOT NULL DEFAULT 'APPROVED',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "carMake" TEXT,
    "carModel" TEXT,
    "carColor" TEXT,
    "plateNumber" TEXT,

    CONSTRAINT "IntercityDriverProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntercityOrder" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "passengerId" TEXT NOT NULL,
    "driverId" TEXT,
    "status" "IntercityOrderStatus" NOT NULL DEFAULT 'SEARCHING_DRIVER',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CARD',
    "fromCity" TEXT NOT NULL,
    "toCity" TEXT NOT NULL,
    "departureAt" TIMESTAMP(3) NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "baggage" TEXT,
    "comment" TEXT,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "IntercityOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntercityOrderStatusHistory" (
    "id" TEXT NOT NULL,
    "intercityOrderId" TEXT NOT NULL,
    "status" "IntercityOrderStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntercityOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntercityDriverProfile_userId_key" ON "IntercityDriverProfile"("userId");

-- AddForeignKey
ALTER TABLE "IntercityDriverProfile" ADD CONSTRAINT "IntercityDriverProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntercityOrder" ADD CONSTRAINT "IntercityOrder_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "PassengerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntercityOrder" ADD CONSTRAINT "IntercityOrder_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "IntercityDriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntercityOrderStatusHistory" ADD CONSTRAINT "IntercityOrderStatusHistory_intercityOrderId_fkey" FOREIGN KEY ("intercityOrderId") REFERENCES "IntercityOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

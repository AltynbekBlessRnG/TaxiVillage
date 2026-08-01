ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'KASPI_TRANSFER';
ALTER TYPE "FoodOrderStatus" ADD VALUE IF NOT EXISTS 'SEARCHING_DRIVER';
ALTER TYPE "FoodOrderStatus" ADD VALUE IF NOT EXISTS 'DRIVER_ASSIGNED';
ALTER TYPE "FoodOrderStatus" ADD VALUE IF NOT EXISTS 'AT_MERCHANT';

CREATE TYPE "MerchantVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'SUSPENDED');
CREATE TYPE "PromoDiscountType" AS ENUM ('FIXED', 'PERCENT');
CREATE TYPE "MerchantSettlementType" AS ENUM ('COMMISSION_CHARGE', 'PAYMENT', 'ADJUSTMENT');

ALTER TABLE "Merchant"
  ADD COLUMN "contactPhone" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "lat" DOUBLE PRECISION,
  ADD COLUMN "lng" DOUBLE PRECISION,
  ADD COLUMN "openingHours" JSONB,
  ADD COLUMN "deliveryRadiusKm" DOUBLE PRECISION NOT NULL DEFAULT 8,
  ADD COLUMN "deliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 700,
  ADD COLUMN "commissionPercent" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN "freeOrderLimit" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "completedOrderCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "commissionDebt" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "commissionDebtLimit" DECIMAL(10,2) NOT NULL DEFAULT 10000,
  ADD COLUMN "verificationStatus" "MerchantVerificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "logoImageUrl" TEXT;

-- Existing production merchants were already visible before this migration.
UPDATE "Merchant" SET "verificationStatus" = 'VERIFIED';

ALTER TABLE "FoodOrder"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "driverId" TEXT,
  ADD COLUMN "deliveryLat" DOUBLE PRECISION,
  ADD COLUMN "deliveryLng" DOUBLE PRECISION,
  ADD COLUMN "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "deliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "commissionAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "driverPayout" DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN "passengerPhoneSnapshot" TEXT,
  ADD COLUMN "merchantPhoneSnapshot" TEXT,
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "acceptedAt" TIMESTAMP(3),
  ADD COLUMN "searchingDriverAt" TIMESTAMP(3),
  ADD COLUMN "driverAssignedAt" TIMESTAMP(3),
  ADD COLUMN "arrivedAtMerchantAt" TIMESTAMP(3),
  ADD COLUMN "pickedUpAt" TIMESTAMP(3),
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "merchantAlertedAt" TIMESTAMP(3),
  ADD COLUMN "driverAlertedAt" TIMESTAMP(3);

UPDATE "FoodOrder"
SET "subtotal" = "totalPrice"
WHERE "subtotal" = 0;

ALTER TABLE "FoodOrder"
  ALTER COLUMN "paymentMethod" SET DEFAULT 'CASH';

CREATE TABLE "PromoCode" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "code" TEXT NOT NULL,
  "merchantId" TEXT,
  "discountType" "PromoDiscountType" NOT NULL,
  "discountValue" DECIMAL(10,2) NOT NULL,
  "maxDiscount" DECIMAL(10,2),
  "minSubtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "usageLimit" INTEGER,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "perUserLimit" INTEGER NOT NULL DEFAULT 1,
  "startsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromoCodeRedemption" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "promoCodeId" TEXT NOT NULL,
  "passengerId" TEXT NOT NULL,
  "foodOrderId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  CONSTRAINT "PromoCodeRedemption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MerchantSettlement" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "merchantId" TEXT NOT NULL,
  "foodOrderId" TEXT,
  "type" "MerchantSettlementType" NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "note" TEXT,
  CONSTRAINT "MerchantSettlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FoodOrder_idempotencyKey_key" ON "FoodOrder"("idempotencyKey");
CREATE INDEX "FoodOrder_status_createdAt_idx" ON "FoodOrder"("status", "createdAt");
CREATE INDEX "FoodOrder_driverId_status_idx" ON "FoodOrder"("driverId", "status");
CREATE INDEX "FoodOrder_merchantId_status_idx" ON "FoodOrder"("merchantId", "status");
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");
CREATE INDEX "PromoCode_merchantId_isActive_idx" ON "PromoCode"("merchantId", "isActive");
CREATE UNIQUE INDEX "PromoCodeRedemption_foodOrderId_key" ON "PromoCodeRedemption"("foodOrderId");
CREATE UNIQUE INDEX "PromoCodeRedemption_promoCodeId_passengerId_key" ON "PromoCodeRedemption"("promoCodeId", "passengerId");
CREATE INDEX "MerchantSettlement_merchantId_createdAt_idx" ON "MerchantSettlement"("merchantId", "createdAt");
CREATE INDEX "MerchantSettlement_foodOrderId_idx" ON "MerchantSettlement"("foodOrderId");

ALTER TABLE "FoodOrder"
  ADD CONSTRAINT "FoodOrder_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromoCode"
  ADD CONSTRAINT "PromoCode_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromoCodeRedemption"
  ADD CONSTRAINT "PromoCodeRedemption_promoCodeId_fkey"
  FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromoCodeRedemption"
  ADD CONSTRAINT "PromoCodeRedemption_passengerId_fkey"
  FOREIGN KEY ("passengerId") REFERENCES "PassengerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromoCodeRedemption"
  ADD CONSTRAINT "PromoCodeRedemption_foodOrderId_fkey"
  FOREIGN KEY ("foodOrderId") REFERENCES "FoodOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MerchantSettlement"
  ADD CONSTRAINT "MerchantSettlement_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "PromoCode" (
  "id",
  "createdAt",
  "updatedAt",
  "code",
  "discountType",
  "discountValue",
  "maxDiscount",
  "minSubtotal",
  "usageLimit",
  "usageCount",
  "perUserLimit",
  "isActive"
) VALUES (
  'beta-usharal500-2026',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  'USHARAL500',
  'FIXED',
  500,
  500,
  1500,
  100,
  0,
  1,
  true
);

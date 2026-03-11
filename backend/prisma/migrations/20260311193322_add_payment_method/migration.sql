-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'CASH');

-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CARD';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "phoneVerifiedAt" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "PhoneOtpChannel" AS ENUM ('TELEGRAM');

-- CreateEnum
CREATE TYPE "PhoneOtpPurpose" AS ENUM ('REGISTER', 'LOGIN');

-- CreateTable
CREATE TABLE "PhoneOtpSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verificationToken" TEXT,
    "telegramChatId" TEXT,
    "telegramDeliveredAt" TIMESTAMP(3),
    "channel" "PhoneOtpChannel" NOT NULL DEFAULT 'TELEGRAM',
    "purpose" "PhoneOtpPurpose" NOT NULL,
    "payload" JSONB,

    CONSTRAINT "PhoneOtpSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhoneOtpSession_verificationToken_key" ON "PhoneOtpSession"("verificationToken");

-- CreateIndex
CREATE INDEX "PhoneOtpSession_phone_purpose_idx" ON "PhoneOtpSession"("phone", "purpose");

-- CreateIndex
CREATE INDEX "PhoneOtpSession_expiresAt_idx" ON "PhoneOtpSession"("expiresAt");

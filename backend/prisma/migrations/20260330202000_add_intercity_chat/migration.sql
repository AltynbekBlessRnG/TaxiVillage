-- CreateTable
CREATE TABLE "IntercityMessage" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  "intercityOrderId" TEXT,
  "intercityBookingId" TEXT,
  "senderUserId" TEXT NOT NULL,
  "receiverUserId" TEXT NOT NULL,
  "senderType" "MessageSender" NOT NULL,
  "receiverType" "MessageSender" NOT NULL,
  "content" TEXT NOT NULL,
  CONSTRAINT "IntercityMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IntercityMessage_intercityOrderId_createdAt_idx" ON "IntercityMessage"("intercityOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "IntercityMessage_intercityBookingId_createdAt_idx" ON "IntercityMessage"("intercityBookingId", "createdAt");

-- AddForeignKey
ALTER TABLE "IntercityMessage" ADD CONSTRAINT "IntercityMessage_intercityOrderId_fkey" FOREIGN KEY ("intercityOrderId") REFERENCES "IntercityOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntercityMessage" ADD CONSTRAINT "IntercityMessage_intercityBookingId_fkey" FOREIGN KEY ("intercityBookingId") REFERENCES "IntercityBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntercityMessage" ADD CONSTRAINT "IntercityMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntercityMessage" ADD CONSTRAINT "IntercityMessage_receiverUserId_fkey" FOREIGN KEY ("receiverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

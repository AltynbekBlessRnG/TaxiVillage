-- Create unified chat table
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),
    "rideId" TEXT,
    "intercityOrderId" TEXT,
    "intercityBookingId" TEXT,
    "senderUserId" TEXT NOT NULL,
    "receiverUserId" TEXT NOT NULL,
    "senderType" "MessageSender" NOT NULL,
    "receiverType" "MessageSender" NOT NULL,
    "content" TEXT NOT NULL,
    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ChatMessage"
ADD CONSTRAINT "ChatMessage_rideId_fkey"
FOREIGN KEY ("rideId") REFERENCES "Ride"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChatMessage"
ADD CONSTRAINT "ChatMessage_intercityOrderId_fkey"
FOREIGN KEY ("intercityOrderId") REFERENCES "IntercityOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChatMessage"
ADD CONSTRAINT "ChatMessage_intercityBookingId_fkey"
FOREIGN KEY ("intercityBookingId") REFERENCES "IntercityBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChatMessage"
ADD CONSTRAINT "ChatMessage_senderUserId_fkey"
FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChatMessage"
ADD CONSTRAINT "ChatMessage_receiverUserId_fkey"
FOREIGN KEY ("receiverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "ChatMessage_rideId_createdAt_idx" ON "ChatMessage"("rideId", "createdAt");
CREATE INDEX "ChatMessage_intercityOrderId_createdAt_idx" ON "ChatMessage"("intercityOrderId", "createdAt");
CREATE INDEX "ChatMessage_intercityBookingId_createdAt_idx" ON "ChatMessage"("intercityBookingId", "createdAt");

-- Migrate taxi chat messages from profile-based ids to user-based ids
INSERT INTO "ChatMessage" (
  "id",
  "createdAt",
  "readAt",
  "rideId",
  "senderUserId",
  "receiverUserId",
  "senderType",
  "receiverType",
  "content"
)
SELECT
  m."id",
  m."createdAt",
  m."readAt",
  m."rideId",
  CASE
    WHEN m."senderType" = 'PASSENGER' THEN p_sender."userId"
    ELSE d_sender."userId"
  END AS "senderUserId",
  CASE
    WHEN m."receiverType" = 'PASSENGER' THEN p_receiver."userId"
    ELSE d_receiver."userId"
  END AS "receiverUserId",
  m."senderType",
  m."receiverType",
  m."content"
FROM "Message" m
LEFT JOIN "PassengerProfile" p_sender ON p_sender."id" = m."senderId"
LEFT JOIN "DriverProfile" d_sender ON d_sender."id" = m."senderId"
LEFT JOIN "PassengerProfile" p_receiver ON p_receiver."id" = m."receiverId"
LEFT JOIN "DriverProfile" d_receiver ON d_receiver."id" = m."receiverId";

-- Migrate intercity chat messages
INSERT INTO "ChatMessage" (
  "id",
  "createdAt",
  "readAt",
  "intercityOrderId",
  "intercityBookingId",
  "senderUserId",
  "receiverUserId",
  "senderType",
  "receiverType",
  "content"
)
SELECT
  im."id",
  im."createdAt",
  im."readAt",
  im."intercityOrderId",
  im."intercityBookingId",
  im."senderUserId",
  im."receiverUserId",
  im."senderType",
  im."receiverType",
  im."content"
FROM "IntercityMessage" im;

DROP TABLE IF EXISTS "IntercityMessage";
DROP TABLE IF EXISTS "Message";

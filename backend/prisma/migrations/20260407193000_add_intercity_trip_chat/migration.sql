-- Add trip-scoped intercity chat support
ALTER TABLE "ChatMessage"
ADD COLUMN "messageGroupId" TEXT,
ADD COLUMN "intercityTripId" TEXT;

CREATE INDEX "ChatMessage_intercityTripId_createdAt_idx"
ON "ChatMessage"("intercityTripId", "createdAt");

ALTER TABLE "ChatMessage"
ADD CONSTRAINT "ChatMessage_intercityTripId_fkey"
FOREIGN KEY ("intercityTripId") REFERENCES "IntercityTrip"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

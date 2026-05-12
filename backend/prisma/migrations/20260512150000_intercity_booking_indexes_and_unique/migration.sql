-- Deduplicate rows that would violate the new unique constraint (keep newest by createdAt, then id).
DELETE FROM "IntercityBooking"
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT
      "id",
      ROW_NUMBER() OVER (
        PARTITION BY "tripId", "passengerId", "status"
        ORDER BY "createdAt" DESC, "id" DESC
      ) AS rn
    FROM "IntercityBooking"
  ) ranked
  WHERE ranked.rn > 1
);

-- CreateIndex
CREATE INDEX "IntercityBooking_tripId_status_idx" ON "IntercityBooking"("tripId", "status");

-- CreateIndex
CREATE INDEX "IntercityBooking_passengerId_status_idx" ON "IntercityBooking"("passengerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IntercityBooking_tripId_passengerId_status_key" ON "IntercityBooking"("tripId", "passengerId", "status");

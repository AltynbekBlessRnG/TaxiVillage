-- AlterTable
ALTER TABLE "DriverProfile"
ADD COLUMN "lastCourierOrderFinishedAt" TIMESTAMP(3);

-- Backfill courier completion timestamp from legacy courier profiles
UPDATE "DriverProfile" AS dp
SET "lastCourierOrderFinishedAt" = cp."lastOrderFinishedAt"
FROM "CourierProfile" AS cp
WHERE cp."userId" = dp."userId"
  AND cp."lastOrderFinishedAt" IS NOT NULL
  AND dp."lastCourierOrderFinishedAt" IS NULL;

-- Switch courier orders from CourierProfile ids to DriverProfile ids
ALTER TABLE "CourierOrder" DROP CONSTRAINT IF EXISTS "CourierOrder_courierId_fkey";

UPDATE "CourierOrder" AS co
SET "courierId" = dp."id"
FROM "CourierProfile" AS cp
JOIN "DriverProfile" AS dp ON dp."userId" = cp."userId"
WHERE co."courierId" = cp."id";

ALTER TABLE "CourierOrder"
ADD CONSTRAINT "CourierOrder_courierId_fkey"
FOREIGN KEY ("courierId") REFERENCES "DriverProfile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Switch intercity passenger orders from IntercityDriverProfile ids to DriverProfile ids
ALTER TABLE "IntercityOrder" DROP CONSTRAINT IF EXISTS "IntercityOrder_driverId_fkey";

UPDATE "IntercityOrder" AS io
SET "driverId" = dp."id"
FROM "IntercityDriverProfile" AS idp
JOIN "DriverProfile" AS dp ON dp."userId" = idp."userId"
WHERE io."driverId" = idp."id";

ALTER TABLE "IntercityOrder"
ADD CONSTRAINT "IntercityOrder_driverId_fkey"
FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop legacy worker profile tables
DROP TABLE IF EXISTS "CourierProfile";
DROP TABLE IF EXISTS "IntercityDriverProfile";

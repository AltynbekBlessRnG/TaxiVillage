-- AlterTable
ALTER TABLE "DriverProfile" ADD COLUMN     "documentsVerified" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: drivers whose papers an admin already approved.
UPDATE "DriverProfile" d SET "documentsVerified" = true
WHERE (
  EXISTS (SELECT 1 FROM "DriverDocument" x WHERE x."driverId" = d.id AND x.approved AND x.type = 'DRIVER_LICENSE')
  AND EXISTS (SELECT 1 FROM "DriverDocument" x WHERE x."driverId" = d.id AND x.approved AND x.type = 'CAR_REGISTRATION')
) OR EXISTS (SELECT 1 FROM "DriverDocument" x WHERE x."driverId" = d.id AND x.approved AND x.type = 'COURIER_ID');

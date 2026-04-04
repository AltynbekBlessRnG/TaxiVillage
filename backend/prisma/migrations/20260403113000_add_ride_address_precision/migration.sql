CREATE TYPE "AddressPrecision" AS ENUM ('EXACT', 'LANDMARK_TEXT');

ALTER TABLE "Ride"
ADD COLUMN "pickupLocationPrecision" "AddressPrecision" NOT NULL DEFAULT 'EXACT',
ADD COLUMN "dropoffLocationPrecision" "AddressPrecision" NOT NULL DEFAULT 'EXACT';

-- CreateEnum
CREATE TYPE "PlaceKind" AS ENUM ('POI', 'STREET', 'AREA');

-- CreateEnum
CREATE TYPE "PlaceSource" AS ENUM ('OSM', 'MANUAL', 'RIDE');

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "kind" "PlaceKind" NOT NULL,
    "category" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "source" "PlaceSource" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Place_externalId_key" ON "Place"("externalId");

-- CreateIndex
CREATE INDEX "Place_lat_lng_idx" ON "Place"("lat", "lng");

-- CreateIndex
CREATE INDEX "Place_kind_isActive_idx" ON "Place"("kind", "isActive");

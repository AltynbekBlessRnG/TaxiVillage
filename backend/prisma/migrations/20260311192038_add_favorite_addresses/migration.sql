-- CreateTable
CREATE TABLE "FavoriteAddress" (
    "id" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FavoriteAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteAddress_passengerId_name_key" ON "FavoriteAddress"("passengerId", "name");

-- AddForeignKey
ALTER TABLE "FavoriteAddress" ADD CONSTRAINT "FavoriteAddress_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "PassengerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

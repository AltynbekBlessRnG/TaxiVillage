-- RenameForeignKey
ALTER TABLE "Message" RENAME CONSTRAINT "Message_receiverId_fkey" TO "Message_receiverId_passenger_fkey";

-- RenameForeignKey
ALTER TABLE "Message" RENAME CONSTRAINT "Message_senderId_fkey" TO "Message_senderId_passenger_fkey";

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_driver_fkey" FOREIGN KEY ("senderId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverId_driver_fkey" FOREIGN KEY ("receiverId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

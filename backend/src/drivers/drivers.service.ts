import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentType, DriverStatus, RideStatus } from '@prisma/client';
import { RidesGateway } from '../rides/rides.gateway';

@Injectable()
export class DriversService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ridesGateway: RidesGateway,
  ) {}

  async setOnlineStatus(userId: string, isOnline: boolean) {
    // If going online, validate driver profile
    if (isOnline) {
      const driver = await this.prisma.driverProfile.findUnique({
        where: { userId },
        include: { car: true, documents: true },
      });

      if (!driver) {
        throw new NotFoundException('Профиль водителя не найден');
      }

      // Check driver approval status
      if (driver.status !== DriverStatus.APPROVED) {
        throw new BadRequestException('Водитель не одобрен администратором');
      }

      // Check car information
      if (!driver.car) {
        throw new BadRequestException('Необходимо добавить информацию об автомобиле');
      }
      if (!driver.car.make || !driver.car.model || !driver.car.color || !driver.car.plateNumber) {
        throw new BadRequestException('Необходимо заполнить все поля автомобиля (марка, модель, цвет, номер)');
      }

      // Check approved documents
      const approvedDocuments = driver.documents.filter((doc) => doc.approved);
      const hasDriverLicense = approvedDocuments.some((doc) => doc.type === DocumentType.DRIVER_LICENSE);
      const hasCarRegistration = approvedDocuments.some((doc) => doc.type === DocumentType.CAR_REGISTRATION);

      if (!hasDriverLicense) {
        throw new BadRequestException('Необходимо загрузить и получить одобрение водительского удостоверения');
      }
      if (!hasCarRegistration) {
        throw new BadRequestException('Необходимо загрузить и получить одобрение СТС (свидетельство о регистрации ТС)');
      }
    }

    const data: { isOnline: boolean; lastRideFinishedAt?: Date } = { isOnline };
    if (isOnline) {
      data.lastRideFinishedAt = new Date();
    }
    const driver = await this.prisma.driverProfile.update({
      where: { userId },
      data,
    });
    return driver;
  }

  async updateLocation(userId: string, lat: number, lng: number) {
    const driver = await this.prisma.driverProfile.update({
      where: { userId },
      data: { lat, lng },
    });

    // Check if driver has an active ride and emit driver movement
    const currentRide = await this.prisma.ride.findFirst({
      where: {
        driverId: driver.id,
        status: {
          in: [RideStatus.ON_THE_WAY, RideStatus.IN_PROGRESS],
        },
      },
    });

    if (currentRide) {
      this.ridesGateway.emitDriverMoved(currentRide.id, lat, lng);
    }

    return driver;
  }

  async getCurrentRideForDriver(userId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    return this.prisma.ride.findFirst({
      where: {
        driverId: driver.id,
        status: {
          in: [
            RideStatus.DRIVER_ASSIGNED,
            RideStatus.ON_THE_WAY,
            RideStatus.IN_PROGRESS,
          ],
        },
      },
    });
  }

  async upsertCar(
    userId: string,
    data: { make: string; model: string; color: string; plateNumber: string },
  ) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: { car: true },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }
    if (driver.car) {
      return this.prisma.car.update({
        where: { id: driver.car.id },
        data,
      });
    }
    return this.prisma.car.create({
      data: {
        driverId: driver.id,
        ...data,
      },
    });
  }

  async addDocument(
    userId: string,
    type: DocumentType,
    fileUrl: string,
  ) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }
    return this.prisma.driverDocument.create({
      data: {
        driverId: driver.id,
        type,
        url: fileUrl,
      },
    });
  }

  async getProfile(userId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: { car: true, documents: true },
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }
    return driver;
  }
}


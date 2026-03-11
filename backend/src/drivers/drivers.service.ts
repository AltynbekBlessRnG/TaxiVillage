import { Injectable, NotFoundException, BadRequestException, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentType, DriverStatus, RideStatus } from '@prisma/client';
import { RidesGateway } from '../rides/rides.gateway';

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);
  
  constructor(
    private readonly prisma: PrismaService,
    private readonly ridesGateway: RidesGateway,
  ) {}

  private locationCache = new Map<string, { lat: number; lng: number; lastUpdate: Date }>();
  private readonly BATCH_INTERVAL = 30000; // 30 seconds
  private readonly CACHE_CLEANUP_INTERVAL = 60000; // 1 minute - clean old entries
  private locationBatchTimer?: NodeJS.Timeout;
  private cacheCleanupTimer?: NodeJS.Timeout;

  // Start location batching on service initialization
  onModuleInit() {
    this.locationBatchTimer = setInterval(() => {
      this.flushLocationBatch();
    }, this.BATCH_INTERVAL);
    
    this.cacheCleanupTimer = setInterval(() => {
      this.cleanupOldCacheEntries();
    }, this.CACHE_CLEANUP_INTERVAL);
  }

  // Cleanup on service destruction
  onModuleDestroy() {
    if (this.locationBatchTimer) {
      clearInterval(this.locationBatchTimer);
      this.flushLocationBatch(); // Flush any remaining updates
    }
    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
    }
  }

  private cleanupOldCacheEntries() {
    const now = new Date();
    const STALE_TIME = 120000; // 2 minutes
    
    for (const [userId, location] of this.locationCache.entries()) {
      if (now.getTime() - location.lastUpdate.getTime() > STALE_TIME) {
        this.locationCache.delete(userId);
      }
    }
    
    if (this.locationCache.size > 0) {
      this.logger.debug(`Location cache contains ${this.locationCache.size} active drivers`);
    }
  }

  private async flushLocationBatch() {
    if (this.locationCache.size === 0) return;

    const updates: Array<{ userId: string; lat: number; lng: number }> = [];
    
    for (const [userId, location] of this.locationCache.entries()) {
      updates.push({ userId, lat: location.lat, lng: location.lng });
    }

    if (updates.length > 0) {
      try {
        // Batch update all locations in a single transaction
        await this.prisma.$transaction(
          updates.map(({ userId, lat, lng }) =>
            this.prisma.driverProfile.update({
              where: { userId },
              data: { lat, lng },
            })
          )
        );
        
        this.logger.log(`Batch updated ${updates.length} driver locations`);
      } catch (error) {
        this.logger.error('Failed to batch update locations:', error);
      }
    }

    // Clear the cache
    this.locationCache.clear();
  }

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

    const driver = await this.prisma.driverProfile.update({
      where: { userId },
      data: { isOnline },
    });
    return driver;
  }

  async updateLocation(userId: string, lat: number, lng: number) {
    // Store in cache instead of immediate DB write
    this.locationCache.set(userId, { lat, lng, lastUpdate: new Date() });
    
    // Also update the driver profile immediately for real-time tracking
    // But only if we have an active ride (critical for passenger tracking)
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (driver) {
      // Check if driver has an active ride
      const currentRide = await this.prisma.ride.findFirst({
        where: {
          driverId: driver.id,
          status: {
            in: [RideStatus.ON_THE_WAY, RideStatus.IN_PROGRESS],
          },
        },
      });

      if (currentRide) {
        // For drivers with active rides, update immediately (critical for passenger)
        await this.prisma.driverProfile.update({
          where: { userId },
          data: { lat, lng },
        });
      }
    }

    return { success: true };
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


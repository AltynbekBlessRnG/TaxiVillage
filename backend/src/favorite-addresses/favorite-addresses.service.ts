import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateFavoriteAddressDto {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

function hasValidCoordinates(lat?: number, lng?: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

@Injectable()
export class FavoriteAddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async getFavoriteAddresses(userId: string) {
    const passenger = await this.prisma.passengerProfile.findUnique({
      where: { userId },
    });

    if (!passenger) {
      throw new NotFoundException('Passenger profile not found');
    }

    return this.prisma.favoriteAddress.findMany({
      where: { passengerId: passenger.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFavoriteAddress(userId: string, data: CreateFavoriteAddressDto) {
    const passenger = await this.prisma.passengerProfile.findUnique({
      where: { userId },
    });

    if (!passenger) {
      throw new NotFoundException('Passenger profile not found');
    }

    if (!hasValidCoordinates(data.lat, data.lng)) {
      throw new BadRequestException('Favorite address must contain valid coordinates');
    }

    // Check if address with same name already exists
    const existing = await this.prisma.favoriteAddress.findFirst({
      where: {
        passengerId: passenger.id,
        name: data.name,
      },
    });

    if (existing) {
      throw new BadRequestException('Address with this name already exists');
    }

    return this.prisma.favoriteAddress.create({
      data: {
        passengerId: passenger.id,
        name: data.name,
        address: data.address,
        lat: data.lat,
        lng: data.lng,
      },
    });
  }

  async updateFavoriteAddress(userId: string, addressId: string, data: Partial<CreateFavoriteAddressDto>) {
    const passenger = await this.prisma.passengerProfile.findUnique({
      where: { userId },
    });

    if (!passenger) {
      throw new NotFoundException('Passenger profile not found');
    }

    const address = await this.prisma.favoriteAddress.findFirst({
      where: {
        id: addressId,
        passengerId: passenger.id,
      },
    });

    if (!address) {
      throw new NotFoundException('Favorite address not found');
    }

    if (
      ('lat' in data || 'lng' in data) &&
      !hasValidCoordinates(data.lat ?? address.lat, data.lng ?? address.lng)
    ) {
      throw new BadRequestException('Favorite address must contain valid coordinates');
    }

    // Check if new name conflicts with existing addresses
    if (data.name && data.name !== address.name) {
      const existing = await this.prisma.favoriteAddress.findFirst({
        where: {
          passengerId: passenger.id,
          name: data.name,
          id: { not: addressId },
        },
      });

      if (existing) {
        throw new BadRequestException('Address with this name already exists');
      }
    }

    return this.prisma.favoriteAddress.update({
      where: { id: addressId },
      data,
    });
  }

  async deleteFavoriteAddress(userId: string, addressId: string) {
    const passenger = await this.prisma.passengerProfile.findUnique({
      where: { userId },
    });

    if (!passenger) {
      throw new NotFoundException('Passenger profile not found');
    }

    const address = await this.prisma.favoriteAddress.findFirst({
      where: {
        id: addressId,
        passengerId: passenger.id,
      },
    });

    if (!address) {
      throw new NotFoundException('Favorite address not found');
    }

    return this.prisma.favoriteAddress.delete({
      where: { id: addressId },
    });
  }
}

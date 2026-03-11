import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateFavoriteAddressDto {
  name: string;
  address: string;
  lat: number;
  lng: number;
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

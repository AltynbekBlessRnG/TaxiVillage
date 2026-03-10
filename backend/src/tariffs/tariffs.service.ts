import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class TariffsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.tariff.findMany({
      orderBy: { name: 'asc' },
    });
  }

  findActive() {
    return this.prisma.tariff.findFirst({
      where: { isActive: true },
    });
  }

  async findOne(id: string) {
    const tariff = await this.prisma.tariff.findUnique({
      where: { id },
    });
    if (!tariff) {
      throw new NotFoundException('Tariff not found');
    }
    return tariff;
  }

  create(data: {
    name: string;
    baseFare: number;
    pricePerKm: number;
    pricePerMinute?: number;
    isActive?: boolean;
  }) {
    return this.prisma.tariff.create({
      data: {
        name: data.name,
        baseFare: new Prisma.Decimal(data.baseFare),
        pricePerKm: new Prisma.Decimal(data.pricePerKm),
        pricePerMinute: data.pricePerMinute != null ? new Prisma.Decimal(data.pricePerMinute) : null,
        isActive: data.isActive ?? true,
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      baseFare?: number;
      pricePerKm?: number;
      pricePerMinute?: number;
      isActive?: boolean;
    },
  ) {
    const existing = await this.prisma.tariff.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Tariff not found');
    }
    const updateData: Prisma.TariffUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.baseFare !== undefined) updateData.baseFare = new Prisma.Decimal(data.baseFare);
    if (data.pricePerKm !== undefined) updateData.pricePerKm = new Prisma.Decimal(data.pricePerKm);
    if (data.pricePerMinute !== undefined) {
      updateData.pricePerMinute = new Prisma.Decimal(data.pricePerMinute);
    }
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    return this.prisma.tariff.update({
      where: { id },
      data: updateData,
    });
  }
}

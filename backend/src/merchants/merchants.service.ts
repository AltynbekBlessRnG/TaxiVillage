import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MerchantsService {
  constructor(private readonly prisma: PrismaService) {}

  listPublicMerchants() {
    return this.prisma.merchant.findMany({
      where: { isOpen: true },
      orderBy: [{ rating: 'desc' }, { name: 'asc' }],
    });
  }

  async getMerchantMenu(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      include: {
        menuCategories: {
          include: {
            items: {
              orderBy: { name: 'asc' },
            },
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
    return merchant;
  }

  async getProfile(userId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: {
        user: true,
        menuCategories: {
          include: {
            items: true,
          },
        },
      },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
    return merchant;
  }

  async updateProfile(
    userId: string,
    data: {
      name?: string;
      cuisine?: string;
      description?: string;
      etaMinutes?: number;
      minOrder?: number;
      tone?: string;
      isOpen?: boolean;
    },
  ) {
    return this.prisma.merchant.update({
      where: { userId },
      data: {
        name: data.name,
        cuisine: data.cuisine,
        description: data.description,
        etaMinutes: data.etaMinutes,
        minOrder: data.minOrder,
        tone: data.tone,
        isOpen: data.isOpen,
      },
    });
  }

  async createCategory(userId: string, data: { name: string }) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
      include: { menuCategories: true },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
    return this.prisma.menuCategory.create({
      data: {
        merchantId: merchant.id,
        name: data.name,
        sortOrder: merchant.menuCategories.length,
      },
    });
  }

  async createMenuItem(
    userId: string,
    data: {
      categoryId: string;
      name: string;
      description?: string;
      price: number;
    },
  ) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const category = await this.prisma.menuCategory.findUnique({
      where: { id: data.categoryId },
    });
    if (!category || category.merchantId !== merchant.id) {
      throw new NotFoundException('Category not found');
    }

    return this.prisma.menuItem.create({
      data: {
        categoryId: data.categoryId,
        name: data.name,
        description: data.description || null,
        price: data.price,
      },
    });
  }

  async listMerchantOrders(userId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }
    return this.prisma.foodOrder.findMany({
      where: { merchantId: merchant.id },
      include: {
        items: true,
        passenger: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

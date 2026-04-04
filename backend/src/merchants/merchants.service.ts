import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
              orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
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
            items: {
              orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
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

  async updateProfile(
    userId: string,
    data: {
      whatsAppPhone?: string;
      name?: string;
      cuisine?: string;
      description?: string;
      etaMinutes?: number;
      minOrder?: number;
      tone?: string;
      coverImageUrl?: string;
      isOpen?: boolean;
    },
  ) {
    const updateData: Prisma.MerchantUpdateInput = {
      whatsAppPhone: data.whatsAppPhone,
      name: data.name,
      cuisine: data.cuisine,
      description: data.description,
      etaMinutes: data.etaMinutes,
      minOrder: data.minOrder,
      tone: data.tone,
      coverImageUrl: data.coverImageUrl,
      isOpen: data.isOpen,
    };

    return this.prisma.merchant.update({
      where: { userId },
      data: updateData,
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

  async updateCategory(userId: string, categoryId: string, data: { name?: string }) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const category = await this.prisma.menuCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.merchantId !== merchant.id) {
      throw new NotFoundException('Category not found');
    }

    return this.prisma.menuCategory.update({
      where: { id: categoryId },
      data: {
        name: data.name,
      },
    });
  }

  async deleteCategory(userId: string, categoryId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const category = await this.prisma.menuCategory.findUnique({
      where: { id: categoryId },
      include: {
        items: true,
      },
    });
    if (!category || category.merchantId !== merchant.id) {
      throw new NotFoundException('Category not found');
    }

    if (category.items.length > 0) {
      throw new BadRequestException('Сначала удалите или перенесите блюда из этой категории');
    }

    await this.prisma.menuCategory.delete({
      where: { id: categoryId },
    });

    return { success: true };
  }

  async reorderCategory(userId: string, categoryId: string, direction: 'up' | 'down') {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const categories = await this.prisma.menuCategory.findMany({
      where: { merchantId: merchant.id },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const index = categories.findIndex((category) => category.id === categoryId);
    if (index === -1) {
      throw new NotFoundException('Category not found');
    }

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= categories.length) {
      return { success: true };
    }

    const current = categories[index];
    const target = categories[swapIndex];

    await this.prisma.$transaction([
      this.prisma.menuCategory.update({
        where: { id: current.id },
        data: { sortOrder: target.sortOrder },
      }),
      this.prisma.menuCategory.update({
        where: { id: target.id },
        data: { sortOrder: current.sortOrder },
      }),
    ]);

    return { success: true };
  }

  async createMenuItem(
    userId: string,
    data: {
      categoryId: string;
      name: string;
      description?: string;
      price: number;
      imageUrl?: string;
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
        sortOrder: (await this.prisma.menuItem.count({ where: { categoryId: data.categoryId } })),
        name: data.name,
        description: data.description || null,
        price: data.price,
        imageUrl: data.imageUrl || null,
      },
    });
  }

  async updateMenuItem(
    userId: string,
    itemId: string,
    data: {
      categoryId?: string;
      name?: string;
      description?: string;
      price?: number;
      imageUrl?: string;
    },
  ) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
      include: {
        category: true,
      },
    });
    if (!item || item.category.merchantId !== merchant.id) {
      throw new NotFoundException('Menu item not found');
    }

    if (data.categoryId && data.categoryId !== item.categoryId) {
      const category = await this.prisma.menuCategory.findUnique({
        where: { id: data.categoryId },
      });
      if (!category || category.merchantId !== merchant.id) {
        throw new NotFoundException('Category not found');
      }
    }

    return this.prisma.menuItem.update({
      where: { id: itemId },
      data: {
        categoryId: data.categoryId,
        name: data.name,
        description: data.description,
        price: data.price,
        imageUrl: data.imageUrl,
      },
    });
  }

  async deleteMenuItem(userId: string, itemId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
      include: {
        category: true,
      },
    });
    if (!item || item.category.merchantId !== merchant.id) {
      throw new NotFoundException('Menu item not found');
    }

    await this.prisma.menuItem.delete({
      where: { id: itemId },
    });

    return { success: true };
  }

  async reorderMenuItem(userId: string, itemId: string, direction: 'up' | 'down') {
    const merchant = await this.prisma.merchant.findUnique({
      where: { userId },
    });
    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const item = await this.prisma.menuItem.findUnique({
      where: { id: itemId },
      include: {
        category: true,
      },
    });
    if (!item || item.category.merchantId !== merchant.id) {
      throw new NotFoundException('Menu item not found');
    }

    const items = await this.prisma.menuItem.findMany({
      where: { categoryId: item.categoryId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const index = items.findIndex((current) => current.id === itemId);
    if (index === -1) {
      throw new NotFoundException('Menu item not found');
    }

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= items.length) {
      return { success: true };
    }

    const current = items[index];
    const target = items[swapIndex];

    await this.prisma.$transaction([
      this.prisma.menuItem.update({
        where: { id: current.id },
        data: { sortOrder: target.sortOrder },
      }),
      this.prisma.menuItem.update({
        where: { id: target.id },
        data: { sortOrder: current.sortOrder },
      }),
    ]);

    return { success: true };
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

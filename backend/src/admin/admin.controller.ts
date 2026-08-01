import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Post,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  DriverStatus,
  MerchantVerificationStatus,
  Prisma,
  PromoDiscountType,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from '../auth/admin.guard';
import { FoodOrdersService } from '../food-orders/food-orders.service';

class UpdateDriverStatusDto {
  @IsEnum(DriverStatus)
  status!: DriverStatus;
}

class ApproveDocumentDto {
  @IsBoolean()
  approved!: boolean;
}

class MoneyDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

class CreateMerchantDto {
  @IsString()
  phone!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  cuisine?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}

class UpdateMerchantDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  cuisine?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @IsOptional()
  @IsEnum(MerchantVerificationStatus)
  verificationStatus?: MerchantVerificationStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  deliveryRadiusKm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  commissionPercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  freeOrderLimit?: number;
}

class AssignDriverDto {
  @IsString()
  driverId!: string;
}

class CreateAdminCategoryDto {
  @IsString()
  name!: string;
}

class CreateAdminMenuItemDto {
  @IsString()
  categoryId!: string;

  @IsString()
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  description?: string;
}

class CancelOrderDto {
  @IsString()
  reason!: string;
}

class CreatePromoDto {
  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  merchantId?: string;

  @IsEnum(PromoDiscountType)
  discountType!: PromoDiscountType;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  discountValue!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxDiscount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSubtotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

class UpdatePromoDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly foodOrdersService: FoodOrdersService,
  ) {}

  @Get('users')
  getUsers() {
    return this.prisma.user.findMany({
      include: { passenger: true, driver: true, merchant: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('drivers')
  getDrivers() {
    return this.prisma.driverProfile.findMany({
      include: { user: true, car: true, documents: true },
      orderBy: { user: { createdAt: 'desc' } },
    });
  }

  @Patch('documents/:id/approve')
  async approveDocument(
    @Param('id') documentId: string,
    @Body() dto: ApproveDocumentDto,
  ) {
    const doc = await this.prisma.driverDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return this.prisma.driverDocument.update({
      where: { id: documentId },
      data: { approved: dto.approved },
    });
  }

  @Patch('drivers/:id/status')
  async updateDriverStatus(
    @Param('id') driverId: string,
    @Body() dto: UpdateDriverStatusDto,
  ) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    return this.prisma.driverProfile.update({
      where: { id: driverId },
      data: { status: dto.status },
      include: { user: true, car: true, documents: true },
    });
  }

  @Patch('drivers/:id/top-up')
  async topUpDriverBalance(
    @Param('id') driverId: string,
    @Body() dto: MoneyDto,
  ) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    return this.prisma.driverProfile.update({
      where: { id: driverId },
      data: { balance: { increment: new Prisma.Decimal(dto.amount) } },
      include: { user: true, car: true, documents: true },
    });
  }

  @Get('rides')
  getRides() {
    return this.prisma.ride.findMany({
      include: { passenger: true, driver: true, tariff: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  @Get('merchants')
  getMerchants() {
    return this.prisma.merchant.findMany({
      include: {
        user: true,
        menuCategories: { include: { items: true } },
        settlements: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
      orderBy: { name: 'asc' },
    });
  }

  @Post('merchants')
  async createMerchant(@Body() dto: CreateMerchantDto) {
    const password = await bcrypt.hash(dto.password, 10);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: dto.phone.trim(),
          password,
          role: UserRole.MERCHANT,
          phoneVerifiedAt: new Date(),
        },
      });
      return tx.merchant.create({
        data: {
          userId: user.id,
          name: dto.name.trim(),
          cuisine: dto.cuisine?.trim() || null,
          contactPhone: dto.contactPhone?.trim() || dto.phone.trim(),
          whatsAppPhone: dto.contactPhone?.trim() || dto.phone.trim(),
          address: dto.address?.trim() || null,
          lat: dto.lat,
          lng: dto.lng,
          verificationStatus: MerchantVerificationStatus.PENDING,
        },
        include: { user: true },
      });
    });
  }

  @Patch('merchants/:id')
  async updateMerchant(
    @Param('id') merchantId: string,
    @Body() dto: UpdateMerchantDto,
  ) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return this.prisma.merchant.update({
      where: { id: merchantId },
      data: dto,
      include: { user: true },
    });
  }

  @Post('merchants/:id/menu/categories')
  async createMerchantCategory(
    @Param('id') merchantId: string,
    @Body() dto: CreateAdminCategoryDto,
  ) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');
    return this.prisma.menuCategory.create({
      data: {
        merchantId,
        name: dto.name.trim(),
        sortOrder: await this.prisma.menuCategory.count({ where: { merchantId } }),
      },
    });
  }

  @Post('merchants/:id/menu/items')
  async createMerchantMenuItem(
    @Param('id') merchantId: string,
    @Body() dto: CreateAdminMenuItemDto,
  ) {
    const category = await this.prisma.menuCategory.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category || category.merchantId !== merchantId) {
      throw new NotFoundException('Category not found');
    }
    return this.prisma.menuItem.create({
      data: {
        categoryId: category.id,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        price: new Prisma.Decimal(dto.price),
        sortOrder: await this.prisma.menuItem.count({
          where: { categoryId: category.id },
        }),
      },
    });
  }

  @Post('merchants/:id/settlements/payment')
  async recordMerchantPayment(
    @Param('id') merchantId: string,
    @Body() dto: MoneyDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const merchant = await tx.merchant.findUnique({ where: { id: merchantId } });
      if (!merchant) throw new NotFoundException('Merchant not found');
      const amount = Math.min(dto.amount, Number(merchant.commissionDebt));
      await tx.merchant.update({
        where: { id: merchantId },
        data: { commissionDebt: { decrement: new Prisma.Decimal(amount) } },
      });
      return tx.merchantSettlement.create({
        data: {
          merchantId,
          type: 'PAYMENT',
          amount: new Prisma.Decimal(-amount),
          note: dto.note || 'Оплата комиссии',
        },
      });
    });
  }

  @Get('food-orders')
  getFoodOrders() {
    return this.prisma.foodOrder.findMany({
      include: {
        passenger: { include: { user: true } },
        merchant: { include: { user: true } },
        driver: { include: { user: true, car: true } },
        items: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
  }

  @Post('food-orders/:id/assign-driver')
  assignDriver(
    @Param('id') orderId: string,
    @Body() dto: AssignDriverDto,
  ) {
    return this.foodOrdersService.assignDriverByAdmin(orderId, dto.driverId);
  }

  @Post('food-orders/:id/cancel')
  cancelFoodOrder(
    @Param('id') orderId: string,
    @Body() dto: CancelOrderDto,
    @Req() req: any,
  ) {
    return this.foodOrdersService.cancelOrder(
      req.user.sub,
      UserRole.ADMIN,
      orderId,
      dto.reason,
    );
  }

  @Get('food-problems')
  async getFoodProblems() {
    const now = Date.now();
    const orders = await this.prisma.foodOrder.findMany({
      where: {
        OR: [
          { status: 'CANCELED' },
          { status: 'PLACED', createdAt: { lt: new Date(now - 5 * 60_000) } },
          {
            status: 'SEARCHING_DRIVER',
            searchingDriverAt: { lt: new Date(now - 10 * 60_000) },
          },
        ],
      },
      include: { merchant: true, driver: { include: { user: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return orders.map((order) => ({
      ...order,
      problem:
        order.status === 'CANCELED'
          ? 'CANCELED'
          : order.status === 'PLACED'
            ? 'MERCHANT_TIMEOUT'
            : 'DRIVER_TIMEOUT',
    }));
  }

  @Get('food-economics')
  async getFoodEconomics() {
    const [orders, merchants] = await Promise.all([
      this.prisma.foodOrder.findMany({ where: { status: 'DELIVERED' } }),
      this.prisma.merchant.findMany(),
    ]);
    return {
      deliveredOrders: orders.length,
      gmv: orders.reduce((sum, order) => sum + Number(order.subtotal), 0),
      deliveryRevenue: orders.reduce(
        (sum, order) => sum + Number(order.deliveryFee),
        0,
      ),
      commissionRevenue: orders.reduce(
        (sum, order) => sum + Number(order.commissionAmount),
        0,
      ),
      discounts: orders.reduce(
        (sum, order) => sum + Number(order.discountAmount),
        0,
      ),
      commissionDebt: merchants.reduce(
        (sum, merchant) => sum + Number(merchant.commissionDebt),
        0,
      ),
    };
  }

  @Get('promo-codes')
  getPromoCodes() {
    return this.prisma.promoCode.findMany({
      include: { merchant: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('promo-codes')
  createPromoCode(@Body() dto: CreatePromoDto) {
    return this.prisma.promoCode.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        merchantId: dto.merchantId || null,
        discountType: dto.discountType,
        discountValue: new Prisma.Decimal(dto.discountValue),
        maxDiscount:
          dto.maxDiscount != null ? new Prisma.Decimal(dto.maxDiscount) : null,
        minSubtotal: new Prisma.Decimal(dto.minSubtotal || 0),
        usageLimit: dto.usageLimit,
        perUserLimit: dto.perUserLimit || 1,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  @Patch('promo-codes/:id')
  async updatePromoCode(
    @Param('id') promoId: string,
    @Body() dto: UpdatePromoDto,
  ) {
    const promo = await this.prisma.promoCode.findUnique({ where: { id: promoId } });
    if (!promo) throw new NotFoundException('Promo code not found');
    return this.prisma.promoCode.update({
      where: { id: promoId },
      data: {
        isActive: dto.isActive,
        usageLimit: dto.usageLimit,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }
}

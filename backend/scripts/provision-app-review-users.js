const {
  PrismaClient,
  UserRole,
  DriverStatus,
  MerchantVerificationStatus,
} = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

async function upsertUser({ phone, passwordHash, role, fullName }) {
  const user = await prisma.user.upsert({
    where: { phone },
    update: {
      password: passwordHash,
      role,
      isDeleted: false,
      deletedAt: null,
      phoneVerifiedAt: new Date(),
      refreshTokenHash: null,
    },
    create: {
      phone,
      password: passwordHash,
      role,
      phoneVerifiedAt: new Date(),
    },
  });

  if (role === UserRole.PASSENGER) {
    await prisma.passengerProfile.upsert({
      where: { userId: user.id },
      update: { fullName },
      create: { userId: user.id, fullName },
    });
  }

  if (role === UserRole.DRIVER) {
    await prisma.driverProfile.upsert({
      where: { userId: user.id },
      update: {
        fullName,
        status: DriverStatus.APPROVED,
        supportsTaxi: true,
        supportsCourier: true,
        supportsIntercity: true,
      },
      create: {
        userId: user.id,
        fullName,
        status: DriverStatus.APPROVED,
        supportsTaxi: true,
        supportsCourier: true,
        supportsIntercity: true,
      },
    });
  }

  if (role === UserRole.MERCHANT) {
    await prisma.merchant.upsert({
      where: { userId: user.id },
      update: {
        name: fullName,
        description: 'Демонстрационное заведение для проверки App Store',
        cuisine: 'Домашняя кухня',
        isOpen: true,
        verificationStatus: MerchantVerificationStatus.VERIFIED,
      },
      create: {
        userId: user.id,
        name: fullName,
        description: 'Демонстрационное заведение для проверки App Store',
        cuisine: 'Домашняя кухня',
        isOpen: true,
        verificationStatus: MerchantVerificationStatus.VERIFIED,
      },
    });
  }

  return { phone, role };
}

async function main() {
  if (process.env.APP_REVIEW_LOGIN_ENABLED !== 'true') {
    throw new Error('Set APP_REVIEW_LOGIN_ENABLED=true before provisioning review users');
  }

  const password = required('APP_REVIEW_PASSWORD');
  if (password.length < 12) {
    throw new Error('APP_REVIEW_PASSWORD must contain at least 12 characters');
  }

  const accounts = [
    {
      phone: required('APP_REVIEW_PASSENGER_PHONE'),
      role: UserRole.PASSENGER,
      fullName: 'App Review Passenger',
    },
    {
      phone: required('APP_REVIEW_DRIVER_PHONE'),
      role: UserRole.DRIVER,
      fullName: 'App Review Driver',
    },
    {
      phone: required('APP_REVIEW_MERCHANT_PHONE'),
      role: UserRole.MERCHANT,
      fullName: 'App Review Village Cafe',
    },
  ];

  const allowed = required('APP_REVIEW_PHONES')
    .split(',')
    .map((value) => value.trim());
  for (const account of accounts) {
    if (!allowed.includes(account.phone)) {
      throw new Error(`${account.phone} is not included in APP_REVIEW_PHONES`);
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const provisioned = [];
  for (const account of accounts) {
    provisioned.push(await upsertUser({ ...account, passwordHash }));
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      accounts: provisioned,
      note: 'Password was read from APP_REVIEW_PASSWORD and was not printed.',
    })}\n`,
  );
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

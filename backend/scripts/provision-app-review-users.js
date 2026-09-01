const {
  PrismaClient,
  UserRole,
  DriverStatus,
  DocumentType,
  CourierTransportType,
  MerchantVerificationStatus,
} = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// A driver cannot go on shift without a car and approved documents, so an
// account provisioned without them lets the reviewer sign in and then stops
// them at "Загрузите права". These stand in for the photos a real driver
// uploads; the image says plainly that it is not a real document.
const REVIEW_DOCUMENT_URL = `${
  process.env.APP_REVIEW_DOCUMENT_URL?.trim() || 'https://taxivillage-docs-xp2f.onrender.com'
}/review-document.png`;

const REVIEW_CAR = {
  make: 'Toyota',
  model: 'Camry',
  color: 'Белый',
  plateNumber: '001 ARV 05',
};

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
    const driverFields = {
      fullName,
      status: DriverStatus.APPROVED,
      supportsTaxi: true,
      supportsCourier: true,
      supportsIntercity: true,
      // On foot a courier needs no licence or registration, which would leave
      // two of the three services unreachable; by car all three open up.
      courierTransportType: CourierTransportType.CAR,
    };
    const driver = await prisma.driverProfile.upsert({
      where: { userId: user.id },
      update: driverFields,
      create: { userId: user.id, ...driverFields },
    });

    await prisma.car.upsert({
      where: { driverId: driver.id },
      update: REVIEW_CAR,
      create: { driverId: driver.id, ...REVIEW_CAR },
    });

    // DriverDocument has no unique key on (driverId, type), so replace rather
    // than upsert - re-running this must not pile up duplicates.
    await prisma.driverDocument.deleteMany({ where: { driverId: driver.id } });
    await prisma.driverDocument.createMany({
      data: [
        DocumentType.DRIVER_LICENSE,
        DocumentType.CAR_REGISTRATION,
        DocumentType.TAXI_LICENSE,
        DocumentType.COURIER_ID,
      ].map((type) => ({
        driverId: driver.id,
        type,
        url: REVIEW_DOCUMENT_URL,
        approved: true,
      })),
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

const { io } = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');

const API_BASE = process.env.BACKEND_URL || 'http://localhost:3000/api';
const WS_BASE = API_BASE.replace(/\/api\/?$/, '');
const REDIS_URL = process.env.REDIS_URL || null;
const DRIVER_COUNT = Number(process.env.DRIVER_COUNT || 10);
const DURATION_SECONDS = Number(process.env.DURATION_SECONDS || 180);
const LOCATION_INTERVAL_MS = Number(process.env.LOCATION_INTERVAL_MS || 1000);
const NEARBY_INTERVAL_MS = Number(process.env.NEARBY_INTERVAL_MS || 5000);
const PASSWORD = process.env.LOAD_TEST_PASSWORD || 'password123';
const PHONE_BASE = Number(process.env.LOAD_TEST_PHONE_BASE || 77010000000);

const prisma = new PrismaClient();
const redis = REDIS_URL ? new Redis(REDIS_URL, { maxRetriesPerRequest: null }) : null;

let updatesSent = 0;
let socketsConnected = 0;
let stopRequested = false;

function buildPhone(index) {
  return `+${PHONE_BASE + index}`;
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return {
    status: response.status,
    body,
  };
}

async function registerOrLoginDriver(index) {
  const phone = buildPhone(index);
  const fullName = `Load Driver ${index}`;

  const registerResponse = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      phone,
      password: PASSWORD,
      role: 'DRIVER',
      fullName,
    }),
  });

  if (registerResponse.status !== 201 && registerResponse.status !== 400 && registerResponse.status !== 409 && registerResponse.status !== 500) {
    throw new Error(
      `Failed to register driver ${phone}: ${registerResponse.status} ${JSON.stringify(registerResponse.body)}`,
    );
  }

  const loginResponse = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      phone,
      password: PASSWORD,
    }),
  });

  if (loginResponse.status !== 201) {
    throw new Error(
      `Failed to login driver ${phone}: ${loginResponse.status} ${JSON.stringify(loginResponse.body)}`,
    );
  }

  const userId = loginResponse.body.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { driver: true },
  });

  if (!user) {
    throw new Error(`Missing user after login for ${phone}`);
  }

  const driver =
    user.driver ??
    (await prisma.driverProfile.create({
      data: {
        userId,
        fullName,
        status: 'APPROVED',
        isOnline: false,
        supportsTaxi: true,
        supportsCourier: true,
        supportsIntercity: false,
        driverMode: 'TAXI',
        courierTransportType: 'FOOT',
        balance: 10000,
        rating: 5,
      },
    }));

  await prisma.driverProfile.update({
    where: { userId },
    data: {
      fullName,
      status: 'APPROVED',
      supportsTaxi: true,
      supportsCourier: true,
      supportsIntercity: false,
      driverMode: 'TAXI',
      balance: 10000,
      rating: 5,
    },
  });

  const existingCar = await prisma.car.findUnique({
    where: { driverId: driver.id },
  });
  if (!existingCar) {
    await prisma.car.create({
      data: {
        driverId: driver.id,
        make: 'Toyota',
        model: 'Camry',
        color: 'Black',
        plateNumber: `LOAD-${String(index).padStart(4, '0')}`,
      },
    });
  } else {
    await prisma.car.update({
      where: { id: existingCar.id },
      data: {
        make: existingCar.make || 'Toyota',
        model: existingCar.model || 'Camry',
        color: existingCar.color || 'Black',
        plateNumber: existingCar.plateNumber || `LOAD-${String(index).padStart(4, '0')}`,
      },
    });
  }

  const docs = await prisma.driverDocument.findMany({
    where: { driverId: driver.id },
  });

  const driverLicense = docs.find((doc) => doc.type === 'DRIVER_LICENSE');
  if (!driverLicense) {
    await prisma.driverDocument.create({
      data: {
        driverId: driver.id,
        type: 'DRIVER_LICENSE',
        url: '/load/license.png',
        approved: true,
      },
    });
  } else {
    await prisma.driverDocument.update({
      where: { id: driverLicense.id },
      data: {
        approved: true,
        url: driverLicense.url || '/load/license.png',
      },
    });
  }

  const carRegistration = docs.find((doc) => doc.type === 'CAR_REGISTRATION');
  if (!carRegistration) {
    await prisma.driverDocument.create({
      data: {
        driverId: driver.id,
        type: 'CAR_REGISTRATION',
        url: '/load/registration.png',
        approved: true,
      },
    });
  } else {
    await prisma.driverDocument.update({
      where: { id: carRegistration.id },
      data: {
        approved: true,
        url: carRegistration.url || '/load/registration.png',
      },
    });
  }

  return {
    phone,
    userId,
    accessToken: loginResponse.body.accessToken,
  };
}

async function ensurePassenger() {
  const phone = buildPhone(900000);
  const registerResponse = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      phone,
      password: PASSWORD,
      role: 'PASSENGER',
      fullName: 'Load Passenger',
    }),
  });

  if (
    registerResponse.status !== 201 &&
    registerResponse.status !== 400 &&
    registerResponse.status !== 409 &&
    registerResponse.status !== 500
  ) {
    throw new Error(
      `Failed to register load passenger ${phone}: ${registerResponse.status} ${JSON.stringify(registerResponse.body)}`,
    );
  }

  const loginResponse = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      phone,
      password: PASSWORD,
    }),
  });

  if (loginResponse.status !== 201) {
    throw new Error(
      `Failed to login load passenger ${phone}: ${loginResponse.status} ${JSON.stringify(loginResponse.body)}`,
    );
  }

  return loginResponse.body;
}

async function countKeys(pattern) {
  if (!redis) {
    return 0;
  }
  const keys = await redis.keys(pattern);
  return keys.length;
}

async function printStats(startedAt, passengerToken) {
  const memory = process.memoryUsage();
  let nearbyCount = 0;
  if (passengerToken) {
    const nearbyResponse = await api('/drivers/nearby?lat=43.3525&lng=77.043&radius=10', {
      headers: {
        Authorization: `Bearer ${passengerToken}`,
      },
    });

    if (nearbyResponse.status === 200 && Array.isArray(nearbyResponse.body)) {
      nearbyCount = nearbyResponse.body.length;
    }
  }

  const presenceKeys = await countKeys('presence:*');
  const locationKeys = await countKeys('location:*');
  const activeKeys = await countKeys('active:*');

  console.log(
    JSON.stringify(
      {
        uptimeSec: Math.round((Date.now() - startedAt) / 1000),
        socketsConnected,
        updatesSent,
        heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
        rssMb: Number((memory.rss / 1024 / 1024).toFixed(2)),
        nearbyCount,
        redis: {
          presenceKeys,
          locationKeys,
          activeKeys,
        },
      },
      null,
      2,
    ),
  );
}

async function main() {
  const startedAt = Date.now();
  console.log(`Starting socket load harness with ${DRIVER_COUNT} drivers against ${API_BASE}`);

  const passenger = await ensurePassenger();
  const drivers = [];

  for (let index = 1; index <= DRIVER_COUNT; index += 1) {
    const driver = await registerOrLoginDriver(index);
    drivers.push(driver);
  }

  const sockets = [];
  const intervals = [];

  for (let index = 0; index < drivers.length; index += 1) {
    const driver = drivers[index];

    const statusResponse = await api('/drivers/status', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${driver.accessToken}`,
      },
      body: JSON.stringify({ isOnline: true }),
    });
    if (statusResponse.status !== 201) {
      throw new Error(
        `Failed to set driver ${driver.phone} online: ${statusResponse.status} ${JSON.stringify(statusResponse.body)}`,
      );
    }

    const socket = io(`${WS_BASE}/app`, {
      path: '/socket.io',
      auth: { token: driver.accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    socket.on('connect', () => {
      socketsConnected += 1;
    });
    socket.on('disconnect', () => {
      socketsConnected = Math.max(0, socketsConnected - 1);
    });

    sockets.push(socket);

    let lat = 43.3525 + index * 0.001;
    let lng = 77.043 + index * 0.001;

    const interval = setInterval(async () => {
      if (stopRequested) {
        return;
      }

      lat += 0.0001;
      lng += 0.0001;

      try {
        const response = await api('/drivers/location', {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${driver.accessToken}`,
          },
          body: JSON.stringify({ lat, lng }),
        });
        if (response.status === 200) {
          updatesSent += 1;
        }
      } catch (error) {
        console.warn(`Location update failed for ${driver.phone}: ${String(error)}`);
      }
    }, LOCATION_INTERVAL_MS);

    intervals.push(interval);
  }

  const statsInterval = setInterval(() => {
    void printStats(startedAt, passenger.accessToken);
  }, NEARBY_INTERVAL_MS);

  const shutdown = async () => {
    stopRequested = true;
    clearInterval(statsInterval);
    for (const interval of intervals) {
      clearInterval(interval);
    }
    for (const socket of sockets) {
      socket.removeAllListeners();
      socket.disconnect();
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
    await printStats(startedAt, passenger.accessToken);

    await prisma.$disconnect();
    await redis?.quit().catch(() => null);
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });

  setTimeout(() => {
    void shutdown();
  }, DURATION_SECONDS * 1000);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => null);
  await redis?.quit().catch(() => null);
  process.exit(1);
});

/**
 * Soak / manual load: many taxi drivers online + one ride with reject → accept chain.
 *
 * Env:
 *   BACKEND_URL   default http://localhost:3001/api (Docker host port per project compose)
 *   JWT_SECRET    required — must match backend
 *   DRIVER_COUNT  default 25
 *   DATABASE_URL  required for Prisma user seeding (same DB as API)
 *
 * Run: npm run taxi-dispatch-soak
 */
const { io } = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const API_BASE = process.env.BACKEND_URL || 'http://localhost:3001/api';
const WS_BASE = API_BASE.replace(/\/api\/?$/, '');
const DRIVER_COUNT = Number(process.env.DRIVER_COUNT || 25);
const JWT_SECRET = process.env.JWT_SECRET;
const PASSWORD = process.env.SOAK_PASSWORD || 'password123';
const PHONE_BASE = Number(process.env.SOAK_PHONE_BASE || 77019000000);

const prisma = new PrismaClient();

let offersSeen = 0;
let acceptLatencyMs = null;

function buildPhone(index) {
  return `+${PHONE_BASE + index}`;
}

function signAccessToken(userId, role) {
  return jwt.sign(
    { sub: userId, role, tokenType: 'access' },
    JWT_SECRET,
    { expiresIn: '15m' },
  );
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
  return { status: response.status, body };
}

async function upsertSoakDriver(index) {
  const phone = buildPhone(index);
  const fullName = `Soak Driver ${index}`;
  let user = await prisma.user.findUnique({
    where: { phone },
    include: { driver: true },
  });

  if (!user) {
    const hash = await bcrypt.hash(PASSWORD, 10);
    user = await prisma.user.create({
      data: {
        phone,
        password: hash,
        phoneVerifiedAt: new Date(),
        role: 'DRIVER',
        driver: {
          create: {
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
            lastRideFinishedAt: new Date(Date.UTC(2020, 0, 1 + index)),
          },
        },
      },
      include: { driver: true },
    });
  }

  const driver = user.driver;
  if (!driver) {
    throw new Error(`Missing driver profile for ${phone}`);
  }

  await prisma.driverProfile.update({
    where: { id: driver.id },
    data: {
      fullName,
      status: 'APPROVED',
      supportsTaxi: true,
      balance: 10000,
      lastRideFinishedAt: new Date(Date.UTC(2020, 0, 1 + index)),
    },
  });

  const existingCar = await prisma.car.findUnique({ where: { driverId: driver.id } });
  if (!existingCar) {
    await prisma.car.create({
      data: {
        driverId: driver.id,
        make: 'Toyota',
        model: 'Camry',
        color: 'Black',
        plateNumber: `SOAK-${String(index).padStart(4, '0')}`,
      },
    });
  }

  const docs = await prisma.driverDocument.findMany({ where: { driverId: driver.id } });
  const ensureDoc = async (type, url) => {
    const found = docs.find((d) => d.type === type);
    if (!found) {
      await prisma.driverDocument.create({
        data: { driverId: driver.id, type, url, approved: true },
      });
    } else {
      await prisma.driverDocument.update({
        where: { id: found.id },
        data: { approved: true, url: found.url || url },
      });
    }
  };
  await ensureDoc('DRIVER_LICENSE', '/soak/license.png');
  await ensureDoc('CAR_REGISTRATION', '/soak/registration.png');

  const accessToken = signAccessToken(user.id, user.role);
  return { phone, userId: user.id, driverId: driver.id, accessToken };
}

async function upsertSoakPassenger() {
  const phone = buildPhone(999999);
  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    const hash = await bcrypt.hash(PASSWORD, 10);
    user = await prisma.user.create({
      data: {
        phone,
        password: hash,
        phoneVerifiedAt: new Date(),
        role: 'PASSENGER',
        passenger: {
          create: { fullName: 'Soak Passenger' },
        },
      },
    });
  }
  return { userId: user.id, accessToken: signAccessToken(user.id, user.role) };
}

function connectSocket(accessToken) {
  return new Promise((resolve, reject) => {
    const socket = io(`${WS_BASE}/app`, {
      path: '/socket.io',
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: false,
    });
    const t = setTimeout(() => {
      socket.disconnect();
      reject(new Error('socket connect timeout'));
    }, 15000);
    socket.once('connect', () => {
      clearTimeout(t);
      resolve(socket);
    });
    socket.once('connect_error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

function waitRideOffer(socket, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('ride:offer', handler);
      reject(new Error('ride:offer timeout'));
    }, timeoutMs);
    const handler = (payload) => {
      offersSeen += 1;
      clearTimeout(timer);
      socket.off('ride:offer', handler);
      resolve(payload);
    };
    socket.on('ride:offer', handler);
  });
}

async function main() {
  if (!JWT_SECRET) {
    console.error('Set JWT_SECRET to the same value as the running backend.');
    process.exit(1);
  }

  const started = Date.now();
  console.log(
    JSON.stringify(
      { msg: 'taxi-dispatch-soak start', api: API_BASE, driverCount: DRIVER_COUNT },
      null,
      2,
    ),
  );

  const passenger = await upsertSoakPassenger();
  const drivers = [];
  for (let i = 0; i < DRIVER_COUNT; i += 1) {
    drivers.push(await upsertSoakDriver(i));
  }

  const sockets = [];
  for (const d of drivers) {
    const socket = await connectSocket(d.accessToken);
    sockets.push({ ...d, socket });

    const st = await api('/drivers/status', {
      method: 'POST',
      headers: { Authorization: `Bearer ${d.accessToken}` },
      body: JSON.stringify({ isOnline: true }),
    });
    if (st.status !== 201) {
      throw new Error(`drivers/status ${st.status} ${JSON.stringify(st.body)}`);
    }

    const loc = await api('/drivers/location', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${d.accessToken}` },
      body: JSON.stringify({ lat: 43.3525, lng: 77.043 }),
    });
    if (loc.status !== 200) {
      throw new Error(`drivers/location ${loc.status} ${JSON.stringify(loc.body)}`);
    }
  }

  const firstDriver = sockets[0];
  const secondDriver = sockets[1];

  const offer1Promise = waitRideOffer(firstDriver.socket, 25000);
  const offer2Promise = waitRideOffer(secondDriver.socket, 25000);

  const rideRes = await api('/rides', {
    method: 'POST',
    headers: { Authorization: `Bearer ${passenger.accessToken}` },
    body: JSON.stringify({
      fromAddress: 'Soak A',
      toAddress: 'Soak B',
      fromLat: 43.3521,
      fromLng: 77.0405,
      toLat: 43.1631,
      toLng: 77.0592,
      estimatedPrice: 3500,
      comment: 'soak',
    }),
  });
  if (rideRes.status !== 201) {
    throw new Error(`create ride ${rideRes.status} ${JSON.stringify(rideRes.body)}`);
  }
  const rideId = rideRes.body.id;

  const t0 = Date.now();
  await offer1Promise;

  const rej = await api(`/rides/${rideId}/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${firstDriver.accessToken}` },
    body: JSON.stringify({}),
  });
  if (rej.status !== 201) {
    throw new Error(`reject ${rej.status} ${JSON.stringify(rej.body)}`);
  }

  await offer2Promise;

  const acc = await api(`/rides/${rideId}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secondDriver.accessToken}` },
    body: JSON.stringify({}),
  });
  if (acc.status !== 201) {
    throw new Error(`accept ${acc.status} ${JSON.stringify(acc.body)}`);
  }
  acceptLatencyMs = Date.now() - t0;

  for (const s of sockets) {
    s.socket.disconnect();
  }

  console.log(
    JSON.stringify(
      {
        msg: 'taxi-dispatch-soak done',
        elapsedMs: Date.now() - started,
        rideId,
        offersSeen,
        acceptLatencyMs,
        driversOnline: DRIVER_COUNT,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

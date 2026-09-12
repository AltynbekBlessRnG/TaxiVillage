// Одобряет водителей, ожидающих проверки (status = PENDING).
// Пока в Ушарале водителей знают в лицо, разбирать заявки по одной незачем.
//
// Запуск в Render Shell сервиса taxivillage-backend (DATABASE_URL уже в env):
//   node scripts/approve-drivers.js            — одобрить всех PENDING
//   node scripts/approve-drivers.js +77471268151  — только этот номер
//
// Или локально, с внешним DATABASE_URL из Render:
//   DATABASE_URL='...' node scripts/approve-drivers.js
const { PrismaClient, DriverStatus } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const phones = process.argv.slice(2).map((value) => value.trim()).filter(Boolean);

  const pending = await prisma.driverProfile.findMany({
    where: {
      status: DriverStatus.PENDING,
      ...(phones.length ? { user: { phone: { in: phones } } } : {}),
    },
    select: { id: true, fullName: true, user: { select: { phone: true } } },
  });

  if (!pending.length) {
    process.stdout.write(`${JSON.stringify({ ok: true, approved: 0, note: 'Nothing to approve.' })}\n`);
    return;
  }

  await prisma.driverProfile.updateMany({
    where: { id: { in: pending.map((driver) => driver.id) } },
    data: { status: DriverStatus.APPROVED },
  });

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      approved: pending.length,
      drivers: pending.map((driver) => ({
        id: driver.id,
        phone: driver.user.phone,
        fullName: driver.fullName,
      })),
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

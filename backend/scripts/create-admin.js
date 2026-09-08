// Создаёт (или обновляет) учётку администратора для админ-панели.
// Роль ADMIN нельзя получить через /auth/register — регистрация принимает
// только PASSENGER / DRIVER / MERCHANT, поэтому первый админ заводится так.
//
// Запуск в Render Shell сервиса taxivillage-backend (DATABASE_URL уже в env):
//   ADMIN_PHONE='+7...' ADMIN_PASSWORD='...' node scripts/create-admin.js
//
// Или локально, с внешним DATABASE_URL из Render:
//   DATABASE_URL='...' ADMIN_PHONE='+7...' ADMIN_PASSWORD='...' node scripts/create-admin.js
//
// Пароль не печатается.
const { PrismaClient, UserRole } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

async function main() {
  const phone = required('ADMIN_PHONE');
  const password = required('ADMIN_PASSWORD');

  if (!/^\+\d{10,15}$/.test(phone)) {
    throw new Error('ADMIN_PHONE must be in +7XXXXXXXXXX form');
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { phone },
    update: {
      password: passwordHash,
      role: UserRole.ADMIN,
      isDeleted: false,
      deletedAt: null,
      phoneVerifiedAt: new Date(),
      refreshTokenHash: null,
    },
    create: {
      phone,
      password: passwordHash,
      role: UserRole.ADMIN,
      phoneVerifiedAt: new Date(),
    },
  });

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      id: user.id,
      phone: user.phone,
      role: user.role,
      note: 'Password was read from ADMIN_PASSWORD and was not printed.',
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

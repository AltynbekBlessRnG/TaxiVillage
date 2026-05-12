/**
 * Prisma loads datasource URL during `prisma validate`, so DATABASE_URL must be set
 * even when no database connection is made. CI and fresh clones may not have .env.
 */
const { spawnSync } = require('child_process');

if (!process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL =
    'postgresql://prisma_validate:prisma_validate@127.0.0.1:5432/prisma_validate?schema=public';
}

const result = spawnSync('npx', ['prisma', 'validate'], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);

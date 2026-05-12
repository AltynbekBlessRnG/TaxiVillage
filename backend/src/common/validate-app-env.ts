/**
 * Validates process environment before Nest bootstraps.
 *
 * Contract:
 * - DATABASE_URL, JWT_SECRET: always required.
 * - NODE_ENV=production: also TELEGRAM_WEBHOOK_SECRET (Telegram webhook verification).
 * - REDIS_URL: optional (Redis-backed features degrade when absent).
 * - SENTRY_DSN: optional; when set, Sentry is initialized in main.ts.
 * - UPLOAD_STORAGE: optional, default local disk under ./uploads (see UploadService).
 */
export function validateAppEnv(): void {
  const errors: string[] = [];
  const requireNonEmpty = (name: string) => {
    if (!process.env[name]?.trim()) {
      errors.push(`Missing or empty ${name}`);
    }
  };

  requireNonEmpty('DATABASE_URL');
  requireNonEmpty('JWT_SECRET');

  if (process.env.NODE_ENV === 'production') {
    requireNonEmpty('TELEGRAM_WEBHOOK_SECRET');
  }

  if (errors.length > 0) {
    process.stderr.write(
      `${JSON.stringify({
        level: 'fatal',
        msg: 'env_validation_failed',
        errors,
      })}\n`,
    );
    throw new Error(`Environment validation failed: ${errors.join('; ')}`);
  }

  if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL?.trim()) {
    process.stderr.write(
      `${JSON.stringify({
        level: 'warn',
        msg: 'redis_url_missing_in_production',
        hint: 'Realtime scaling and Socket.IO Redis adapter need REDIS_URL',
      })}\n`,
    );
  }
}

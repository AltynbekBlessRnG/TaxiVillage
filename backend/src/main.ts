import 'reflect-metadata';
import { randomUUID } from 'crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common'; // Добавь Logger
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';
import { RedisService } from './redis/redis.service';
import { validateAppEnv } from './common/validate-app-env';

async function bootstrap() {
  validateAppEnv();

  const sentryDsn = process.env.SENTRY_DSN?.trim();
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Math.min(
        1,
        Math.max(0, Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0)),
      ),
    });
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const redisService = app.get(RedisService);
  const redisAdapter = await redisService.createSocketAdapter(app);
  if (redisAdapter) {
    app.useWebSocketAdapter(redisAdapter);
    Logger.log('Socket.IO Redis adapter enabled', 'Redis');
  } else {
    Logger.warn('Redis adapter disabled, falling back to in-memory Socket.IO', 'Redis');
  }

  app.enableCors();

  app.use((req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    const headerId = req.headers['x-request-id'];
    const requestId =
      typeof headerId === 'string' && headerId.trim().length > 0 ? headerId.trim() : randomUUID();
    (req as import('express').Request & { requestId?: string }).requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const startedAt = Date.now();
    const shouldSkipVerboseLocationLog =
      req.method === 'PATCH' && req.url.includes('/api/drivers/location');

    res.on('finish', () => {
      if (shouldSkipVerboseLocationLog) {
        return;
      }
      const line = JSON.stringify({
        level: 'info',
        msg: 'http_request',
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
      if (res.statusCode >= 500) {
        Logger.error(line, 'HTTP');
      } else {
        Logger.log(line, 'HTTP');
      }
    });

    next();
  });

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 3000;
  // ВАЖНО: Добавь '0.0.0.0', чтобы бэкенд принимал запросы из сети
  await app.listen(port, '0.0.0.0');
  
  console.log(`TaxiVillage backend is running on http://localhost:${port}/api`);
}

bootstrap().catch(async (err) => {
  process.stderr.write(
    `${JSON.stringify({
      level: 'fatal',
      msg: 'bootstrap_failed',
      error: err instanceof Error ? err.message : String(err),
    })}\n`,
  );
  if (process.env.SENTRY_DSN?.trim()) {
    Sentry.captureException(err);
    await Sentry.flush(2000).catch(() => null);
  }
  process.exit(1);
});

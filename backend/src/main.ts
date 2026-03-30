import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common'; // Добавь Logger
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { RedisService } from './redis/redis.service';

async function bootstrap() {
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

  // Добавляем простой Middleware для логирования всех запросов
  app.use((req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    const shouldSkipVerboseLocationLog =
      req.method === 'PATCH' && req.url.includes('/api/drivers/location');

    if (!shouldSkipVerboseLocationLog) {
      Logger.log(`[Request] ${req.method} ${req.url}`, 'HTTP');
    }
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

bootstrap().catch((err) => {
  console.error('Failed to bootstrap application', err);
});

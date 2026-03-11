import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common'; // Добавь Logger
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors();

  // Добавляем простой Middleware для логирования всех запросов
  app.use((req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    Logger.log(`[Request] ${req.method} ${req.url}`, 'HTTP');
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
  console.log(`GraphQL Playground available at http://localhost:${port}/graphql`);
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap application', err);
});
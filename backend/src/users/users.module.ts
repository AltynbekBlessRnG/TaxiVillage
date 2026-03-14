import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller'; // Добавь импорт

@Module({
  controllers: [UsersController], // Добавь это
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
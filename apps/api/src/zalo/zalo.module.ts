import { Module } from '@nestjs/common';
import { ZaloController } from './zalo.controller';
import { ZaloService } from './zalo.service';
import { UsersModule } from '../users/users.module';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [UsersModule, GeminiModule],
  controllers: [ZaloController],
  providers: [ZaloService],
  exports: [ZaloService],
})
export class ZaloModule {}

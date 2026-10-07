import { Module } from '@nestjs/common';
import { ZaloController } from './zalo.controller';
import { ZaloService } from './zalo.service';
import { InputProcessor } from './input-processor.service';
import { ZaloMessageParser } from './zalo-message-parser.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [ZaloController],
  providers: [ZaloService, ZaloMessageParser, InputProcessor],
  exports: [ZaloService, ZaloMessageParser, InputProcessor],
})
export class ZaloModule {}

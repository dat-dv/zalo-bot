import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DeployController } from './deploy.controller';
import { DeployNotifyService } from './deploy-notify.service';
import { UsersModule } from '../users/users.module';
import { ZaloModule } from '../zalo/zalo.module';

@Module({
  imports: [UsersModule, ZaloModule],
  controllers: [HealthController, DeployController],
  providers: [DeployNotifyService],
  exports: [DeployNotifyService],
})
export class HealthModule {}

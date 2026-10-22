import { Module, forwardRef } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DeployController } from './deploy.controller';
import { DeployNotifyGuard } from './deploy-notify.guard';
import { DeployNotifyService } from './deploy-notify.service';
import { UsersModule } from '../users/users.module';
import { ZcaModule } from '../zca/zca.module';

@Module({
  imports: [forwardRef(() => UsersModule), forwardRef(() => ZcaModule)],
  controllers: [HealthController, DeployController],
  providers: [DeployNotifyService, DeployNotifyGuard],
  exports: [DeployNotifyService],
})
export class HealthModule {}

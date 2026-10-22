import { Module } from '@nestjs/common';
import { DashboardAuthModule } from '../dashboard-auth/dashboard-auth.module';
import { UsersModule } from '../users/users.module';
import { AuditController } from './audit.controller';
import { AuditModule } from './audit.module';

/**
 * The admin activity-log API. Kept apart from `AuditModule`, which `ZcaModule` imports, because
 * the admin check needs `UsersModule` and `UsersModule` already imports `ZcaModule`.
 */
@Module({
  imports: [AuditModule, UsersModule, DashboardAuthModule],
  controllers: [AuditController],
})
export class AuditAdminModule {}

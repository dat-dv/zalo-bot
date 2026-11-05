import { Module } from '@nestjs/common';
import { DashboardAuthModule } from '../dashboard-auth/dashboard-auth.module';
import { UsersModule } from '../users/users.module';
import { LlmAdminController } from './llm-admin.controller';
import { LlmModule } from './llm.module';

/**
 * The admin LLM API. Kept apart from `LlmModule`, which `ZcaModule` imports, because the admin
 * check needs `UsersModule` and `UsersModule` already imports `ZcaModule`.
 */
@Module({
  imports: [LlmModule, UsersModule, DashboardAuthModule],
  controllers: [LlmAdminController],
})
export class LlmAdminModule {}

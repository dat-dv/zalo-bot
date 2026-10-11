import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { RedisModule } from './redis/redis.module';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { GoogleModule } from './google/google.module';
import { ZaloModule } from './zalo/zalo.module';
import { RemindersModule } from './reminders/reminders.module';
import { FinanceModule } from './finance/finance.module';
import { AuditModule } from './audit/audit.module';
import { ReportsModule } from './reports/reports.module';
import { fromApiRoot, fromProjectRoot } from './config/project-root';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        fromApiRoot('.env.local'),
        fromApiRoot('.env'),
        fromProjectRoot('.env.local'),
        fromProjectRoot('.env'),
      ],
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    CommonModule,
    HealthModule,
    RedisModule,
    DatabaseModule,
    UsersModule,
    GoogleModule,
    RemindersModule,
    FinanceModule,
    AuditModule,
    ReportsModule,
    ZaloModule,
  ],
})
export class AppModule {}

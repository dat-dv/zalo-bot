import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { GoogleModule } from './google/google.module';
import { GeminiModule } from './gemini/gemini.module';
import { ZaloModule } from './zalo/zalo.module';
import { RemindersModule } from './reminders/reminders.module';
import { FinanceModule } from './finance/finance.module';
import { AuditModule } from './audit/audit.module';
import { ReportsModule } from './reports/reports.module';
import { fromApiRoot, fromProjectRoot } from './config/project-root';
import { GlobalExceptionsFilter } from './common/filters/global-exceptions.filter';

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
    DatabaseModule,
    UsersModule,
    GoogleModule,
    RemindersModule,
    FinanceModule,
    AuditModule,
    ReportsModule,
    GeminiModule,
    ZaloModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionsFilter,
    },
  ],
})
export class AppModule {}

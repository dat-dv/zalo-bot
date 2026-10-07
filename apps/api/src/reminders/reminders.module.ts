import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReminderEntity } from '../database/entities/reminder.entity';
import { RemindersService } from './reminders.service';
import { ReminderSchedulerService } from './reminder-scheduler.service';
import { RemindersController } from './reminders.controller';
import { DashboardAuthModule } from '../dashboard-auth/dashboard-auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([ReminderEntity]), DashboardAuthModule, UsersModule],
  controllers: [RemindersController],
  providers: [RemindersService, ReminderSchedulerService],
  exports: [RemindersService],
})
export class RemindersModule {}

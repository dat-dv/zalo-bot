import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReminderEntity } from '../database/entities/reminder.entity';
import { UserEntity } from '../database/entities/user.entity';
import { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import { RemindersService } from './reminders.service';
import { ReminderSchedulerService } from './reminder-scheduler.service';
import { RemindersController } from './reminders.controller';
import { ReminderTargetService } from './reminder-target.service';
import { ReminderTargetsController } from './reminder-targets.controller';
import { DashboardAuthModule } from '../dashboard-auth/dashboard-auth.module';
import { UsersModule } from '../users/users.module';
import { ZcaModule } from '../zca/zca.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReminderEntity, UserEntity, ZcaThreadConfigEntity]),
    DashboardAuthModule,
    forwardRef(() => UsersModule),
    forwardRef(() => ZcaModule),
  ],
  controllers: [RemindersController, ReminderTargetsController],
  providers: [RemindersService, ReminderSchedulerService, ReminderTargetService],
  exports: [RemindersService, ReminderTargetService],
})
export class RemindersModule {}

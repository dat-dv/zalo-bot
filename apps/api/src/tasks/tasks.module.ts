import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEntity } from '../database/entities/task.entity';
import { UserEntity } from '../database/entities/user.entity';
import { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import { DashboardAuthModule } from '../dashboard-auth/dashboard-auth.module';
import { UsersModule } from '../users/users.module';
import { ZcaModule } from '../zca/zca.module';
import { TaskReminderSchedulerService } from './task-reminder-scheduler.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity, UserEntity, ZcaThreadConfigEntity]),
    DashboardAuthModule,
    forwardRef(() => UsersModule),
    forwardRef(() => ZcaModule),
  ],
  controllers: [TasksController],
  providers: [TasksService, TaskReminderSchedulerService],
  exports: [TasksService],
})
export class TasksModule {}

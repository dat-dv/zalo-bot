import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEntity } from '../database/entities/task.entity';
import { UserEntity } from '../database/entities/user.entity';
import { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import { DashboardAuthModule } from '../dashboard-auth/dashboard-auth.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity, UserEntity, ZcaThreadConfigEntity]),
    DashboardAuthModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}

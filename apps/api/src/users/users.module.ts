import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UsersService } from './users.service';
import { UserEntity } from '../database/entities/user.entity';
import { UsersController } from './users.controller';
import { UserMergeService } from './user-merge.service';
import {
  USER_MERGE_UNIT_OF_WORK,
  USER_MERGE_USERS_PORT,
  type UserMergeUnitOfWork,
} from './user-merge.types';
import { DashboardAuthModule } from '../dashboard-auth/dashboard-auth.module';
import { ZcaModule } from '../zca/zca.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([UserEntity]),
    DashboardAuthModule,
    forwardRef(() => ZcaModule),
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    UserMergeService,
    {
      provide: USER_MERGE_UNIT_OF_WORK,
      inject: [DataSource],
      useFactory: (dataSource: DataSource): UserMergeUnitOfWork => ({
        manager: dataSource.manager,
        transaction: (work) => dataSource.transaction((manager) => work(manager)),
      }),
    },
    { provide: USER_MERGE_USERS_PORT, useExisting: UsersService },
  ],
  exports: [UsersService],
})
export class UsersModule {}

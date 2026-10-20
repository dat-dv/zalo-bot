import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UsersService } from './users.service';
import { UserEntity } from '../database/entities/user.entity';
import { DebtContactEntity } from '../database/entities/debt-contact.entity';
import { DebtEntity } from '../database/entities/debt.entity';
import { UsersController } from './users.controller';
import { UserMergeService } from './user-merge.service';
import { UserLinkedContactsService } from './user-linked-contacts.service';
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
    TypeOrmModule.forFeature([UserEntity, DebtContactEntity, DebtEntity]),
    DashboardAuthModule,
    forwardRef(() => ZcaModule),
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    UserMergeService,
    UserLinkedContactsService,
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

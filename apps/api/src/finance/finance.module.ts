import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceTransactionEntity } from '../database/entities/finance-transaction.entity';
import { DebtEntity } from '../database/entities/debt.entity';
import { DebtContactEntity } from '../database/entities/debt-contact.entity';
import { DebtPaymentEntity } from '../database/entities/debt-payment.entity';
import { DebtPaymentAllocationEntity } from '../database/entities/debt-payment-allocation.entity';
import { UserCategoryEntity } from '../database/entities/user-category.entity';
import { FinancePlaceEntity } from '../database/entities/finance-place.entity';
import { SavingGroupEntity } from '../database/entities/saving-group.entity';
import { SavingMovementEntity } from '../database/entities/saving-movement.entity';
import { UserEntity } from '../database/entities/user.entity';
import { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';
import { ContactUserSyncService } from './contact-user-sync.service';
import { DashboardAuthModule } from '../dashboard-auth/dashboard-auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FinanceTransactionEntity,
      DebtEntity,
      DebtContactEntity,
      DebtPaymentEntity,
      DebtPaymentAllocationEntity,
      UserCategoryEntity,
      FinancePlaceEntity,
      SavingGroupEntity,
      SavingMovementEntity,
      UserEntity,
      ZcaThreadConfigEntity,
    ]),
    DashboardAuthModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [FinanceController, SavingsController],
  providers: [FinanceService, SavingsService, ContactUserSyncService],
  exports: [FinanceService],
})
export class FinanceModule {}

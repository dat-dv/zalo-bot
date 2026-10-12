import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceTransactionEntity } from '../database/entities/finance-transaction.entity';
import { DebtEntity } from '../database/entities/debt.entity';
import { DebtContactEntity } from '../database/entities/debt-contact.entity';
import { DebtPaymentEntity } from '../database/entities/debt-payment.entity';
import { DebtPaymentAllocationEntity } from '../database/entities/debt-payment-allocation.entity';
import { UserCategoryEntity } from '../database/entities/user-category.entity';
import { FinancePlaceEntity } from '../database/entities/finance-place.entity';
import { UserEntity } from '../database/entities/user.entity';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { DashboardAuthModule } from '../dashboard-auth/dashboard-auth.module';

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
      UserEntity,
    ]),
    DashboardAuthModule,
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}

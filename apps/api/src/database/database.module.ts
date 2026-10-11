import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { UserTokenEntity } from './entities/user-token.entity';
import { ReminderEntity } from './entities/reminder.entity';
import { FinanceTransactionEntity } from './entities/finance-transaction.entity';
import { DebtEntity } from './entities/debt.entity';
import { DebtContactEntity } from './entities/debt-contact.entity';
import { DebtPaymentEntity } from './entities/debt-payment.entity';
import { DebtPaymentAllocationEntity } from './entities/debt-payment-allocation.entity';
import { AuditLogEntity } from './entities/audit-log.entity';
import { DashboardExchangeTokenEntity } from './entities/dashboard-exchange-token.entity';
import { UserCategoryEntity } from './entities/user-category.entity';
import { FinancePlaceEntity } from './entities/finance-place.entity';
import { AuditLogSubscriber } from './audit-log.subscriber';
import { InitSchema1724650000000 } from './migrations/1724650000000-InitSchema';
import { MigrateLegacyPlaceContacts1724660000000 } from './migrations/1724660000000-MigrateLegacyPlaceContacts';
import { CreateDebtPaymentAllocations1724670000000 } from './migrations/1724670000000-CreateDebtPaymentAllocations';
import { AddParentDebtHierarchy1724680000000 } from './migrations/1724680000000-AddParentDebtHierarchy';
import { FixPostgresUuidTypes1724690000000 } from './migrations/1724690000000-FixPostgresUuidTypes';
import { FixPostgresPlaceAndContactUuidTypes1724700000000 } from './migrations/1724700000000-FixPostgresPlaceAndContactUuidTypes';
import { DropInvitesTable1724710000000 } from './migrations/1724710000000-DropInvitesTable';
import { AddGrantAccessToUsers1724720000000 } from './migrations/1724720000000-AddGrantAccessToUsers';
import { AddLinkedUserIdToDebtContacts1724730000000 } from './migrations/1724730000000-AddLinkedUserIdToDebtContacts';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const databaseUrl = (process.env.DATABASE_URL || '').trim();
        const databaseSsl = process.env.DATABASE_SSL?.trim().toLowerCase() === 'true';
        const synchronize = process.env.TYPEORM_SYNCHRONIZE?.trim().toLowerCase() === 'true';
        const entities = [
          UserEntity,
          UserTokenEntity,
          ReminderEntity,
          FinanceTransactionEntity,
          DebtEntity,
          DebtContactEntity,
          DebtPaymentEntity,
          DebtPaymentAllocationEntity,
          AuditLogEntity,
          DashboardExchangeTokenEntity,
          UserCategoryEntity,
          FinancePlaceEntity,
        ];

        return {
          type: 'postgres' as const,
          url: databaseUrl,
          ssl: databaseSsl ? { rejectUnauthorized: false } : false,
          entities,
          subscribers: [AuditLogSubscriber],
          migrations: [
            InitSchema1724650000000,
            MigrateLegacyPlaceContacts1724660000000,
            CreateDebtPaymentAllocations1724670000000,
            AddParentDebtHierarchy1724680000000,
            FixPostgresUuidTypes1724690000000,
            FixPostgresPlaceAndContactUuidTypes1724700000000,
            DropInvitesTable1724710000000,
            AddGrantAccessToUsers1724720000000,
            AddLinkedUserIdToDebtContacts1724730000000,
          ],
          migrationsRun: true,
          migrationsTableName: 'typeorm_migrations',
          synchronize,
          logging: false,
          retryAttempts: 25,
          retryDelay: 2000,
        };
      },
    }),
    TypeOrmModule.forFeature([
      UserEntity,
      UserTokenEntity,
      ReminderEntity,
      FinanceTransactionEntity,
      DebtEntity,
      DebtContactEntity,
      DebtPaymentEntity,
      DebtPaymentAllocationEntity,
      AuditLogEntity,
      DashboardExchangeTokenEntity,
      UserCategoryEntity,
      FinancePlaceEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

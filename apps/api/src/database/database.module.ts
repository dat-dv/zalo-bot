import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { InviteEntity } from './entities/invite.entity';
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
import { MigrazalogacyPlaceContacts1724660000000 } from './migrations/1724660000000-MigrazalogacyPlaceContacts';
import { CreateDebtPaymentAllocations1724670000000 } from './migrations/1724670000000-CreateDebtPaymentAllocations';
import { AddParentDebtHierarchy1724680000000 } from './migrations/1724680000000-AddParentDebtHierarchy';
import { FixPostgresUuidTypes1724690000000 } from './migrations/1724690000000-FixPostgresUuidTypes';
import { FixPostgresPlaceAndContactUuidTypes1724700000000 } from './migrations/1724700000000-FixPostgresPlaceAndContactUuidTypes';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL.trim();
        const databaseSsl = process.env.DATABASE_SSL?.trim().toLowerCase() === 'true';
        const synchronize = process.env.TYPEORM_SYNCHRONIZE?.trim().toLowerCase() === 'true';
        const entities = [
          UserEntity,
          InviteEntity,
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
            MigrazalogacyPlaceContacts1724660000000,
            CreateDebtPaymentAllocations1724670000000,
            AddParentDebtHierarchy1724680000000,
            FixPostgresUuidTypes1724690000000,
            FixPostgresPlaceAndContactUuidTypes1724700000000,
          ],
          migrationsRun: true,
          migrationsTableName: 'typeorm_migrations',
          synchronize,
          logging: false,
        };
      },
    }),
    TypeOrmModule.forFeature([
      UserEntity,
      InviteEntity,
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

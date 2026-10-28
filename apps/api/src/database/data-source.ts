import { DataSource } from 'typeorm';
import { config as loadDotenv } from 'dotenv';
import { fromProjectRoot } from '../config/project-root';
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
import { ZcaThreadConfigEntity } from './entities/zca-thread-config.entity';
import { ZcaMessageEntity } from './entities/zca-message.entity';
import { ZcaChannelNoteEntity } from './entities/zca-channel-note.entity';
import { ZcaLearnedFactEntity } from './entities/zca-learned-fact.entity';
import { ZcaMemoryIngestionEntity } from './entities/zca-memory-ingestion.entity';
import { ZcaMemorySegmentEntity } from './entities/zca-memory-segment.entity';
import { ChannelStorageLinkEntity } from './entities/channel-storage-link.entity';
import { CalendarEventEntity } from './entities/calendar-event.entity';
import { TaskEntity } from './entities/task.entity';
import { TaskReminderTimeEntity } from './entities/task-reminder-time.entity';
import { ReminderTimeEntity } from './entities/reminder-time.entity';
import { WebhookRecipientEntity } from './entities/webhook-recipient.entity';
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
import { CreateZcaThreadConfigs1724740000000 } from './migrations/1724740000000-CreateZcaThreadConfigs';
import { AddDirectInteractionToZcaThreadConfigs1724750000000 } from './migrations/1724750000000-AddDirectInteractionToZcaThreadConfigs';
import { AddDriveFolderColumnsToUsersAndThreadConfigs1724760000000 } from './migrations/1724760000000-AddDriveFolderColumnsToUsersAndThreadConfigs';
import { AddPhotosAlbumColumnsToZcaThreadConfigs1724770000000 } from './migrations/1724770000000-AddPhotosAlbumColumnsToZcaThreadConfigs';
import { AddSharedLedgerAndTransactionCreator1724780000000 } from './migrations/1724780000000-AddSharedLedgerAndTransactionCreator';
import { RemoveFinanceUserScope1724790000000 } from './migrations/1724790000000-RemoveFinanceUserScope';
import { DropZcaPassiveTrackingColumns1724800000000 } from './migrations/1724800000000-DropZcaPassiveTrackingColumns';
import { CreateZcaMessages1724810000000 } from './migrations/1724810000000-CreateZcaMessages';
import { AddChatMemoryToZcaThreadConfigs1724820000000 } from './migrations/1724820000000-AddChatMemoryToZcaThreadConfigs';
import { CreateChannelStorageLinks1724830000000 } from './migrations/1724830000000-CreateChannelStorageLinks';
import { AddDisplayNameToChannelStorageLinks1724840000000 } from './migrations/1724840000000-AddDisplayNameToChannelStorageLinks';
import { AddProfileFieldsToDebtContacts1724850000000 } from './migrations/1724850000000-AddProfileFieldsToDebtContacts';
import { AddCodeHashToDashboardExchangeTokens1724860000000 } from './migrations/1724860000000-AddCodeHashToDashboardExchangeTokens';
import { CreateCalendarEvents1724870000000 } from './migrations/1724870000000-CreateCalendarEvents';
import { CreateTasks1724880000000 } from './migrations/1724880000000-CreateTasks';
import { DropTaskGoogleCopy1724890000000 } from './migrations/1724890000000-DropTaskGoogleCopy';
import { AddMemberAccessToZcaThreadConfigs1724900000000 } from './migrations/1724900000000-AddMemberAccessToZcaThreadConfigs';
import { AddReminderToTasks1724910000000 } from './migrations/1724910000000-AddReminderToTasks';
import { AddReminderTargets1724930000000 } from './migrations/1724930000000-AddReminderTargets';
import { CreateReminderTimes1724940000000 } from './migrations/1724940000000-CreateReminderTimes';
import { AddAuditLogActorSource1724950000000 } from './migrations/1724950000000-AddAuditLogActorSource';
import { AddReminderRepeatAndNag1724960000000 } from './migrations/1724960000000-AddReminderRepeatAndNag';
import { AddAuditLogActorName1724970000000 } from './migrations/1724970000000-AddAuditLogActorName';
import { AddChatMemoryV21724980000000 } from './migrations/1724980000000-AddChatMemoryV2';
import { AddChatMemorySegments1724990000000 } from './migrations/1724990000000-AddChatMemorySegments';
import { CreateWebhookRecipients1725000000000 } from './migrations/1725000000000-CreateWebhookRecipients';

// Load environment variables for TypeORM CLI từ root
loadDotenv({ path: fromProjectRoot('.env.local') });
loadDotenv({ path: fromProjectRoot('.env') });

const databaseUrl = (
  process.env.DATABASE_URL || 'postgresql://zalobot:zalobot@localhost:5432/zalobot'
).trim();
const databaseSsl = process.env.DATABASE_SSL?.trim().toLowerCase() === 'true';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  ssl: databaseSsl ? { rejectUnauthorized: false } : false,
  entities: [
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
    ZcaThreadConfigEntity,
    ZcaMessageEntity,
    ZcaChannelNoteEntity,
    ZcaLearnedFactEntity,
    ZcaMemoryIngestionEntity,
    ZcaMemorySegmentEntity,
    ChannelStorageLinkEntity,
    CalendarEventEntity,
    TaskEntity,
    TaskReminderTimeEntity,
    ReminderTimeEntity,
    WebhookRecipientEntity,
  ],
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
    CreateZcaThreadConfigs1724740000000,
    AddDirectInteractionToZcaThreadConfigs1724750000000,
    AddDriveFolderColumnsToUsersAndThreadConfigs1724760000000,
    AddPhotosAlbumColumnsToZcaThreadConfigs1724770000000,
    AddSharedLedgerAndTransactionCreator1724780000000,
    RemoveFinanceUserScope1724790000000,
    DropZcaPassiveTrackingColumns1724800000000,
    CreateZcaMessages1724810000000,
    AddChatMemoryToZcaThreadConfigs1724820000000,
    CreateChannelStorageLinks1724830000000,
    AddDisplayNameToChannelStorageLinks1724840000000,
    AddProfileFieldsToDebtContacts1724850000000,
    AddCodeHashToDashboardExchangeTokens1724860000000,
    CreateCalendarEvents1724870000000,
    CreateTasks1724880000000,
    DropTaskGoogleCopy1724890000000,
    AddMemberAccessToZcaThreadConfigs1724900000000,
    AddReminderToTasks1724910000000,
    AddReminderTargets1724930000000,
    CreateReminderTimes1724940000000,
    AddAuditLogActorSource1724950000000,
    AddReminderRepeatAndNag1724960000000,
    AddAuditLogActorName1724970000000,
    AddChatMemoryV21724980000000,
    AddChatMemorySegments1724990000000,
    CreateWebhookRecipients1725000000000,
  ],
  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
});

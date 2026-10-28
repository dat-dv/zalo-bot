import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZcaService } from './zca.service';
import { ZcaController } from './zca.controller';
import { ZCA_MODULE_OPTIONS } from './zca.constants';
import type { ZcaModuleOptions } from './zca.interfaces';
import { WelcomeGroupEventStrategy } from './strategies/welcome-group-event.strategy';
import { GroupEventDispatcher } from './group-event-dispatcher.service';
import { ThreadConfigService } from './thread-config.service';
import { ZcaBotFeatureService } from './zca-bot-feature.service';
import { AuditModule } from '../audit/audit.module';
import { ReceiptStorageModule } from '../receipt-storage/receipt-storage.module';
import { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import { UsersModule } from '../users/users.module';
import { FinanceModule } from '../finance/finance.module';
import { RemindersModule } from '../reminders/reminders.module';
import { GoogleModule } from '../google/google.module';
import { CalendarModule } from '../calendar/calendar.module';
import { TasksModule } from '../tasks/tasks.module';
import { LlmModule } from '../llm/llm.module';
import { OcrModule } from '../ocr/ocr.module';
import { DashboardAuthModule } from '../dashboard-auth/dashboard-auth.module';
import { ChatMemoryModule } from './memory/chat-memory.module';
import { MemoryIngestService } from './memory/long-term/memory-ingest.service';
import { MemorySegmentScheduler } from './memory/long-term/memory-segment.scheduler';
import { ChannelMemoryController } from './memory/channel-memory.controller';
import {
  CHAT_MEMORY_QUEUE,
  MemoryIngestProcessor,
} from './memory/long-term/memory-ingest.processor';
import { ZcaMemoryIngestionEntity } from '../database/entities/zca-memory-ingestion.entity';
import { ZcaMemorySegmentEntity } from '../database/entities/zca-memory-segment.entity';
import { ChannelStorageLinkModule } from './storage/channel-storage-link.module';

// Chat pipeline: messenger, text input and tool strategies
import { ZcaMessengerService } from './zca-messenger.service';
import { TextInputService } from './text/text-input.service';
import { TextToolFactory } from './text/text-tool.factory';
import { TEXT_TOOL_STRATEGY_PROVIDERS } from './text/text-tool.providers';
import { ShareDriveToolStrategy } from './text/strategies/share-drive-tool.strategy';

// Confirmation & Guards
import { TransactionConfirmationService } from './confirmation/transaction-confirmation.service';
import { InitialAdminBootstrapGuard } from './guards/initial-admin-bootstrap.guard';
import { GrantAccessGuard } from './guards/grant-access.guard';
import { ThreadAccessService } from './access/thread-access.service';

// Webhook
import { ZcaWebhookController } from './webhook/zca-webhook.controller';
import { WebhookApiKeyGuard } from './webhook/guards/webhook-api-key.guard';
import { WebhookRateLimiter } from './webhook/webhook-rate-limiter';
import { WebhookIpLimiter } from './webhook/webhook-ip-limiter';
import { WebhookIpLimitGuard } from './webhook/guards/webhook-ip-limit.guard';

// Pending Image & Batching
import { PendingImageActionService } from './pending-image/pending-image-action.service';
import { PendingImageActionDispatcher } from './pending-image/pending-image-dispatcher.service';
import { ImageBatchHandler } from './pending-image/image-batch-handler.service';
import { CancelPendingImageStrategy } from './pending-image/strategies/cancel-pending-image.strategy';
import { StorageUploadPendingImageStrategy } from './pending-image/strategies/storage-upload-pending-image.strategy';
import { CreateBillPendingImageStrategy } from './pending-image/strategies/create-bill-pending-image.strategy';

const COMMON_IMPORTS = [
  TypeOrmModule.forFeature([
    ZcaThreadConfigEntity,
    ZcaMemoryIngestionEntity,
    ZcaMemorySegmentEntity,
  ]),
  BullModule.registerQueue({ name: CHAT_MEMORY_QUEUE }),
  AuditModule,
  forwardRef(() => ReceiptStorageModule),
  forwardRef(() => UsersModule),
  FinanceModule,
  forwardRef(() => RemindersModule),
  forwardRef(() => GoogleModule),
  forwardRef(() => CalendarModule),
  forwardRef(() => TasksModule),
  LlmModule,
  OcrModule,
  DashboardAuthModule,
  ChatMemoryModule,
  ChannelStorageLinkModule,
];

const COMMON_PROVIDERS = [
  ZcaMessengerService,
  TextInputService,
  TextToolFactory,
  ...TEXT_TOOL_STRATEGY_PROVIDERS,
  WelcomeGroupEventStrategy,
  GroupEventDispatcher,
  ThreadConfigService,
  ZcaBotFeatureService,
  ZcaService,
  TransactionConfirmationService,
  InitialAdminBootstrapGuard,
  GrantAccessGuard,
  ThreadAccessService,
  PendingImageActionService,
  PendingImageActionDispatcher,
  ImageBatchHandler,
  CancelPendingImageStrategy,
  StorageUploadPendingImageStrategy,
  CreateBillPendingImageStrategy,
  MemoryIngestService,
  MemoryIngestProcessor,
  MemorySegmentScheduler,
  WebhookApiKeyGuard,
  WebhookRateLimiter,
  WebhookIpLimiter,
  WebhookIpLimitGuard,
];

const COMMON_EXPORTS = [
  ZcaMessengerService,
  TextInputService,
  TextToolFactory,
  ShareDriveToolStrategy,
  WelcomeGroupEventStrategy,
  GroupEventDispatcher,
  ThreadConfigService,
  ZcaBotFeatureService,
  ZcaService,
  TransactionConfirmationService,
  InitialAdminBootstrapGuard,
  GrantAccessGuard,
  ThreadAccessService,
  PendingImageActionService,
  PendingImageActionDispatcher,
  ImageBatchHandler,
  CancelPendingImageStrategy,
  StorageUploadPendingImageStrategy,
  CreateBillPendingImageStrategy,
  MemoryIngestService,
  MemorySegmentScheduler,
];

@Module({
  imports: COMMON_IMPORTS,
  controllers: [ZcaController, ChannelMemoryController, ZcaWebhookController],
  providers: COMMON_PROVIDERS,
  exports: COMMON_EXPORTS,
})
export class ZcaModule {
  public static register(options?: ZcaModuleOptions): DynamicModule {
    return {
      module: ZcaModule,
      imports: COMMON_IMPORTS,
      controllers: [ZcaController, ChannelMemoryController, ZcaWebhookController],
      providers: [
        {
          provide: ZCA_MODULE_OPTIONS,
          useValue: options || {},
        },
        ...COMMON_PROVIDERS,
      ],
      exports: COMMON_EXPORTS,
    };
  }

  public static forRoot(options?: ZcaModuleOptions): DynamicModule {
    return {
      global: true,
      module: ZcaModule,
      imports: COMMON_IMPORTS,
      controllers: [ZcaController, ChannelMemoryController, ZcaWebhookController],
      providers: [
        {
          provide: ZCA_MODULE_OPTIONS,
          useValue: options || {},
        },
        ...COMMON_PROVIDERS,
      ],
      exports: COMMON_EXPORTS,
    };
  }
}

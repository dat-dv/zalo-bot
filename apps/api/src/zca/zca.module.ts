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
import { ZaloModule } from '../zalo/zalo.module';
import { ReceiptStorageModule } from '../receipt-storage/receipt-storage.module';
import { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import { UsersModule } from '../users/users.module';
import { FinanceModule } from '../finance/finance.module';
import { RemindersModule } from '../reminders/reminders.module';
import { GoogleModule } from '../google/google.module';
import { LlmModule } from '../llm/llm.module';
import { OcrModule } from '../ocr/ocr.module';

// Confirmation & Guards
import { TransactionConfirmationService } from './confirmation/transaction-confirmation.service';
import { InitialAdminBootstrapGuard } from './guards/initial-admin-bootstrap.guard';
import { GrantAccessGuard } from './guards/grant-access.guard';

// Pending Image & Batching
import { PendingImageActionService } from './pending-image/pending-image-action.service';
import { PendingImageActionDispatcher } from './pending-image/pending-image-dispatcher.service';
import { ImageBatchHandler } from './pending-image/image-batch-handler.service';
import { CancelPendingImageStrategy } from './pending-image/strategies/cancel-pending-image.strategy';
import { StorageUploadPendingImageStrategy } from './pending-image/strategies/storage-upload-pending-image.strategy';
import { CreateBillPendingImageStrategy } from './pending-image/strategies/create-bill-pending-image.strategy';

const COMMON_IMPORTS = [
  TypeOrmModule.forFeature([ZcaThreadConfigEntity]),
  forwardRef(() => ZaloModule),
  forwardRef(() => ReceiptStorageModule),
  forwardRef(() => UsersModule),
  FinanceModule,
  forwardRef(() => RemindersModule),
  forwardRef(() => GoogleModule),
  LlmModule,
  OcrModule,
];

const COMMON_PROVIDERS = [
  WelcomeGroupEventStrategy,
  GroupEventDispatcher,
  ThreadConfigService,
  ZcaBotFeatureService,
  ZcaService,
  TransactionConfirmationService,
  InitialAdminBootstrapGuard,
  GrantAccessGuard,
  PendingImageActionService,
  PendingImageActionDispatcher,
  ImageBatchHandler,
  CancelPendingImageStrategy,
  StorageUploadPendingImageStrategy,
  CreateBillPendingImageStrategy,
];

const COMMON_EXPORTS = [
  WelcomeGroupEventStrategy,
  GroupEventDispatcher,
  ThreadConfigService,
  ZcaBotFeatureService,
  ZcaService,
  TransactionConfirmationService,
  InitialAdminBootstrapGuard,
  GrantAccessGuard,
  PendingImageActionService,
  PendingImageActionDispatcher,
  ImageBatchHandler,
  CancelPendingImageStrategy,
  StorageUploadPendingImageStrategy,
  CreateBillPendingImageStrategy,
];

@Module({
  imports: COMMON_IMPORTS,
  controllers: [ZcaController],
  providers: COMMON_PROVIDERS,
  exports: COMMON_EXPORTS,
})
export class ZcaModule {
  public static register(options?: ZcaModuleOptions): DynamicModule {
    return {
      module: ZcaModule,
      imports: COMMON_IMPORTS,
      controllers: [ZcaController],
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
      controllers: [ZcaController],
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

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

@Module({
  imports: [
    TypeOrmModule.forFeature([ZcaThreadConfigEntity]),
    forwardRef(() => ZaloModule),
    forwardRef(() => ReceiptStorageModule),
  ],
  controllers: [ZcaController],
  providers: [
    WelcomeGroupEventStrategy,
    GroupEventDispatcher,
    ThreadConfigService,
    ZcaBotFeatureService,
    ZcaService,
  ],
  exports: [
    WelcomeGroupEventStrategy,
    GroupEventDispatcher,
    ThreadConfigService,
    ZcaBotFeatureService,
    ZcaService,
  ],
})
export class ZcaModule {
  public static register(options?: ZcaModuleOptions): DynamicModule {
    return {
      module: ZcaModule,
      imports: [
        TypeOrmModule.forFeature([ZcaThreadConfigEntity]),
        forwardRef(() => ZaloModule),
        forwardRef(() => ReceiptStorageModule),
      ],
      controllers: [ZcaController],
      providers: [
        {
          provide: ZCA_MODULE_OPTIONS,
          useValue: options || {},
        },
        WelcomeGroupEventStrategy,
        GroupEventDispatcher,
        ThreadConfigService,
        ZcaBotFeatureService,
        ZcaService,
      ],
      exports: [
        WelcomeGroupEventStrategy,
        GroupEventDispatcher,
        ThreadConfigService,
        ZcaBotFeatureService,
        ZcaService,
      ],
    };
  }

  public static forRoot(options?: ZcaModuleOptions): DynamicModule {
    return {
      global: true,
      module: ZcaModule,
      imports: [
        TypeOrmModule.forFeature([ZcaThreadConfigEntity]),
        forwardRef(() => ZaloModule),
        forwardRef(() => ReceiptStorageModule),
      ],
      controllers: [ZcaController],
      providers: [
        {
          provide: ZCA_MODULE_OPTIONS,
          useValue: options || {},
        },
        WelcomeGroupEventStrategy,
        GroupEventDispatcher,
        ThreadConfigService,
        ZcaBotFeatureService,
        ZcaService,
      ],
      exports: [
        WelcomeGroupEventStrategy,
        GroupEventDispatcher,
        ThreadConfigService,
        ZcaBotFeatureService,
        ZcaService,
      ],
    };
  }
}

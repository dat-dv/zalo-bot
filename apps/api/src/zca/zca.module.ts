import { DynamicModule, Module, forwardRef } from '@nestjs/common';
import { ZcaService } from './zca.service';
import { ZcaController } from './zca.controller';
import { ZCA_MODULE_OPTIONS } from './zca.constants';
import type { ZcaModuleOptions } from './zca.interfaces';
import { WelcomeGroupEventStrategy } from './strategies/welcome-group-event.strategy';
import { GroupEventDispatcher } from './group-event-dispatcher.service';
import { ZaloModule } from '../zalo/zalo.module';

@Module({
  imports: [forwardRef(() => ZaloModule)],
  controllers: [ZcaController],
  providers: [WelcomeGroupEventStrategy, GroupEventDispatcher, ZcaService],
  exports: [WelcomeGroupEventStrategy, GroupEventDispatcher, ZcaService],
})
export class ZcaModule {
  public static register(options?: ZcaModuleOptions): DynamicModule {
    return {
      module: ZcaModule,
      imports: [forwardRef(() => ZaloModule)],
      controllers: [ZcaController],
      providers: [
        {
          provide: ZCA_MODULE_OPTIONS,
          useValue: options || {},
        },
        WelcomeGroupEventStrategy,
        GroupEventDispatcher,
        ZcaService,
      ],
      exports: [WelcomeGroupEventStrategy, GroupEventDispatcher, ZcaService],
    };
  }

  public static forRoot(options?: ZcaModuleOptions): DynamicModule {
    return {
      global: true,
      module: ZcaModule,
      imports: [forwardRef(() => ZaloModule)],
      controllers: [ZcaController],
      providers: [
        {
          provide: ZCA_MODULE_OPTIONS,
          useValue: options || {},
        },
        WelcomeGroupEventStrategy,
        GroupEventDispatcher,
        ZcaService,
      ],
      exports: [WelcomeGroupEventStrategy, GroupEventDispatcher, ZcaService],
    };
  }
}

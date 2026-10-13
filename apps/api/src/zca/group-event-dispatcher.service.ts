import { Injectable, Logger, Optional } from '@nestjs/common';
import type { API, GroupEvent } from 'zca-js';
import type { ZcaGroupEventStrategy } from './strategies/group-event.strategy.interface';
import { WelcomeGroupEventStrategy } from './strategies/welcome-group-event.strategy';

@Injectable()
export class GroupEventDispatcher {
  private readonly logger = new Logger(GroupEventDispatcher.name);
  private strategies: ZcaGroupEventStrategy[] = [];

  constructor(@Optional() welcomeStrategy?: WelcomeGroupEventStrategy) {
    if (welcomeStrategy) {
      this.registerStrategy(welcomeStrategy);
    }
  }

  public registerStrategy(strategy: ZcaGroupEventStrategy): this {
    const existingIndex = this.strategies.findIndex((s) => s.name === strategy.name);
    if (existingIndex !== -1) {
      this.strategies[existingIndex] = strategy;
    } else {
      this.strategies.push(strategy);
    }
    this.logger.log(`Registered GroupEvent Strategy: ${strategy.name}`);
    return this;
  }

  public getStrategies(): readonly ZcaGroupEventStrategy[] {
    return this.strategies;
  }

  public async dispatch(event: GroupEvent, api: API): Promise<boolean> {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(event)) {
        try {
          await strategy.handle(event, api);
          return true;
        } catch (err: unknown) {
          const errMsg =
            err instanceof Error
              ? err.message
              : typeof err === 'string'
                ? err
                : JSON.stringify(err);
          this.logger.error(`Error in strategy "${strategy.name}": ${errMsg}`);
        }
      }
    }
    return false;
  }
}

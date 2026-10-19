import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import {
  GroupEventType,
  ThreadType,
  type API,
  type GroupEvent,
  type MessageContent,
  getGroupUpdateMembers,
} from '../shapes';
import type { ZcaGroupEventStrategy } from './group-event.strategy.interface';

export interface WelcomeStrategyOptions {
  enabled?: boolean;
  imagePath?: string;
  customWelcomeSingle?: (name: string) => string;
  customWelcomeMultiple?: () => string;
}

@Injectable()
export class WelcomeGroupEventStrategy implements ZcaGroupEventStrategy {
  public readonly name = 'welcome-group-event-strategy';
  private readonly logger = new Logger(WelcomeGroupEventStrategy.name);
  private imagePath: string;

  constructor(
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly options?: WelcomeStrategyOptions,
  ) {
    const configuredPath =
      this.options?.imagePath ??
      this.configService?.get<string>('zca.welcomeImagePath') ??
      process.env.ZCA_WELCOME_IMAGE_PATH ??
      './welcome.jpg';

    this.imagePath = path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(process.cwd(), configuredPath);
  }

  public isEnabled(): boolean {
    if (this.options?.enabled !== undefined) {
      return this.options.enabled;
    }
    const envVal = process.env.ZCA_ENABLE_WELCOME;
    if (envVal !== undefined) {
      return envVal.toLowerCase() === 'true';
    }
    return this.configService?.get<boolean>('zca.enableWelcome') === true;
  }

  public setImagePath(newPath: string): void {
    this.imagePath = path.isAbsolute(newPath) ? newPath : path.resolve(process.cwd(), newPath);
  }

  public canHandle(event: GroupEvent): boolean {
    if (!this.isEnabled()) {
      return false;
    }
    return event.type === GroupEventType.JOIN && !event.isSelf;
  }

  public async handle(event: GroupEvent, api: API): Promise<boolean> {
    if (event.type !== GroupEventType.JOIN) {
      return false;
    }

    const updateMembers = getGroupUpdateMembers(event);
    if (!updateMembers || updateMembers.length === 0) {
      return false;
    }

    const attachments = fs.existsSync(this.imagePath) ? [this.imagePath] : undefined;
    if (!attachments) {
      this.logger.debug(
        `Welcome image not found at "${this.imagePath}". Sending text-only welcome message.`,
      );
    }

    let messageContent: MessageContent;

    if (updateMembers.length === 1) {
      const member = updateMembers[0];
      const memberName = member.dName || 'bạn mới';
      const welcomeText = this.options?.customWelcomeSingle
        ? this.options.customWelcomeSingle(memberName)
        : `Chào mừng @${memberName} đến với nhóm!`;

      messageContent = {
        msg: welcomeText,
        mentions: [
          {
            pos: 10,
            uid: member.id,
            len: memberName.length + 1,
          },
        ],
        attachments,
      };
    } else {
      const welcomeText = this.options?.customWelcomeMultiple
        ? this.options.customWelcomeMultiple()
        : 'Chào mừng các bạn mới đến với nhóm!';

      messageContent = {
        msg: welcomeText,
        attachments,
      };
    }

    try {
      this.logger.log(`Sending welcome message to group ${event.threadId}...`);
      await api.sendMessage(messageContent, event.threadId, ThreadType.Group);
      this.logger.log(`Sent welcome message to group ${event.threadId} successfully.`);
      return true;
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
      this.logger.error(`Failed to send welcome message to group ${event.threadId}: ${errMsg}`);
      return false;
    }
  }
}

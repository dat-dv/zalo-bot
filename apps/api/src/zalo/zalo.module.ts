import { Module } from '@nestjs/common';
import { ZaloController } from './zalo.controller';
import { ZaloService } from './zalo.service';
import { InputProcessor } from './input-processor.service';
import { ZaloMessageParser } from './zalo-message-parser.service';
import { TextInputService } from './text/text-input.service';
import { TextToolFactory } from './text/text-tool.factory';
import { StartToolStrategy } from './text/strategies/start-tool.strategy';
import { HelpToolStrategy } from './text/strategies/help-tool.strategy';
import { EchoToolStrategy } from './text/strategies/echo-tool.strategy';
import { PingToolStrategy } from './text/strategies/ping-tool.strategy';
import { ResetToolStrategy } from './text/strategies/reset-tool.strategy';
import { ConversationToolStrategy } from './text/strategies/conversation-tool.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [ZaloController],
  providers: [
    ZaloService,
    ZaloMessageParser,
    InputProcessor,
    TextInputService,
    TextToolFactory,
    StartToolStrategy,
    HelpToolStrategy,
    EchoToolStrategy,
    PingToolStrategy,
    ResetToolStrategy,
    ConversationToolStrategy,
  ],
  exports: [ZaloService, ZaloMessageParser, InputProcessor, TextInputService, TextToolFactory],
})
export class ZaloModule {}

import { Injectable } from '@nestjs/common';
import { TextToolType } from './text-tool.enum';
import { TextToolStrategy } from './text-tool.interface';
import { StartToolStrategy } from './strategies/start-tool.strategy';
import { HelpToolStrategy } from './strategies/help-tool.strategy';
import { EchoToolStrategy } from './strategies/echo-tool.strategy';
import { PingToolStrategy } from './strategies/ping-tool.strategy';
import { ResetToolStrategy } from './strategies/reset-tool.strategy';
import { ConversationToolStrategy } from './strategies/conversation-tool.strategy';

@Injectable()
export class TextToolFactory {
  private readonly strategyMap = new Map<TextToolType, TextToolStrategy>();

  constructor(
    startStrategy: StartToolStrategy,
    helpStrategy: HelpToolStrategy,
    echoStrategy: EchoToolStrategy,
    pingStrategy: PingToolStrategy,
    resetStrategy: ResetToolStrategy,
    conversationStrategy: ConversationToolStrategy,
  ) {
    this.strategyMap.set(TextToolType.START, startStrategy);
    this.strategyMap.set(TextToolType.HELP, helpStrategy);
    this.strategyMap.set(TextToolType.ECHO, echoStrategy);
    this.strategyMap.set(TextToolType.PING, pingStrategy);
    this.strategyMap.set(TextToolType.RESET, resetStrategy);
    this.strategyMap.set(TextToolType.CONVERSATION, conversationStrategy);
  }

  public resolveToolType(text: string): TextToolType {
    const trimmed = text.trim();
    if (trimmed.startsWith('/start')) return TextToolType.START;
    if (trimmed.startsWith('/help')) return TextToolType.HELP;
    if (trimmed.startsWith('/echo')) return TextToolType.ECHO;
    if (trimmed.startsWith('/ping')) return TextToolType.PING;
    if (trimmed.startsWith('/reset') || trimmed.startsWith('/clear')) return TextToolType.RESET;
    return TextToolType.CONVERSATION;
  }

  public getStrategy(type: TextToolType): TextToolStrategy {
    const strategy = this.strategyMap.get(type);
    if (!strategy) {
      throw new Error(`Strategy for tool type "${type}" not registered`);
    }
    return strategy;
  }
}

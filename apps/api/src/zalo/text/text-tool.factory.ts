import { Injectable } from '@nestjs/common';
import { TextToolType } from './text-tool.enum';
import { TextToolStrategy } from './text-tool.interface';
import { StartToolStrategy } from './strategies/start-tool.strategy';
import { HelpToolStrategy } from './strategies/help-tool.strategy';
import { EchoToolStrategy } from './strategies/echo-tool.strategy';
import { PingToolStrategy } from './strategies/ping-tool.strategy';
import { ResetToolStrategy } from './strategies/reset-tool.strategy';
import { ConversationToolStrategy } from './strategies/conversation-tool.strategy';
import { ManageDebtToolStrategy } from './strategies/manage-debt-tool.strategy';
import { RecordTransactionToolStrategy } from './strategies/record-transaction-tool.strategy';
import { SetReminderToolStrategy } from './strategies/set-reminder-tool.strategy';
import { GetReportToolStrategy } from './strategies/get-report-tool.strategy';

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
    manageDebtStrategy: ManageDebtToolStrategy,
    recordTransactionStrategy: RecordTransactionToolStrategy,
    setReminderStrategy: SetReminderToolStrategy,
    getReportStrategy: GetReportToolStrategy,
  ) {
    this.strategyMap.set(TextToolType.START, startStrategy);
    this.strategyMap.set(TextToolType.HELP, helpStrategy);
    this.strategyMap.set(TextToolType.ECHO, echoStrategy);
    this.strategyMap.set(TextToolType.PING, pingStrategy);
    this.strategyMap.set(TextToolType.RESET, resetStrategy);
    this.strategyMap.set(TextToolType.CONVERSATION, conversationStrategy);
    this.strategyMap.set(TextToolType.MANAGE_DEBT, manageDebtStrategy);
    this.strategyMap.set(TextToolType.RECORD_TRANSACTION, recordTransactionStrategy);
    this.strategyMap.set(TextToolType.SET_REMINDER, setReminderStrategy);
    this.strategyMap.set(TextToolType.GET_REPORT, getReportStrategy);
  }

  public resolveFastPathToolType(text: string): TextToolType | null {
    const trimmed = text.trim();
    if (trimmed === '/start') return TextToolType.START;
    if (trimmed === '/help') return TextToolType.HELP;
    if (trimmed.startsWith('/echo')) return TextToolType.ECHO;
    if (trimmed === '/ping') return TextToolType.PING;
    if (trimmed === '/reset' || trimmed === '/clear') return TextToolType.RESET;
    return null;
  }

  public resolveToolType(text: string): TextToolType {
    const fastPath = this.resolveFastPathToolType(text);
    if (fastPath) return fastPath;
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

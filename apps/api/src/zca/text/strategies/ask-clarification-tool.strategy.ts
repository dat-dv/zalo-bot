import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';

/** Longest question sent; the LLM is asked for one short sentence. */
export const CLARIFICATION_MAX_LENGTH = 500;

/**
 * Sends the LLM's question when part of a request misses information it cannot guess (a
 * birthday reminder without its date). A tool rather than a plain text reply: plain text is
 * dropped next to other tool calls and regenerated (or silenced) without them.
 */
@Injectable()
export class AskClarificationToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.ASK_CLARIFICATION;
  private readonly logger = new Logger(AskClarificationToolStrategy.name);

  constructor(private readonly zcaMessenger: ZcaMessengerService) {}

  public async execute(context: TextToolContext): Promise<void> {
    const question = context.toolArgs?.question;
    const text = typeof question === 'string' ? question.trim() : '';
    if (!text) {
      this.logger.warn(`ASK_CLARIFICATION without a question in chat ${context.chatId}.`);
      return;
    }
    await this.zcaMessenger.sendMessage(context.chatId, text.slice(0, CLARIFICATION_MAX_LENGTH));
  }
}

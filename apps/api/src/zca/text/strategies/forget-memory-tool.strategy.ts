import { Injectable, Logger, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { TransactionConfirmationService } from '../../confirmation/transaction-confirmation.service';
import { ChannelNotesService } from '../../memory/channel-notes.service';
import { LearnedFactsService } from '../../memory/learned-facts.service';
import { collapseWhitespace } from '../../memory/memory-text.util';

/** Most items one card offers to forget; a vaguer request should be narrowed first. */
export const FORGET_MAX_ITEMS = 5;

/**
 * `FORGET_MEMORY`: "quên vụ mèo đen đi". Finds the chat's notes and learned facts containing
 * every keyword and asks for confirmation on a card listing exactly what will be forgotten.
 */
@Injectable()
export class ForgetMemoryToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.FORGET_MEMORY;
  private readonly logger = new Logger(ForgetMemoryToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly confirmationService: TransactionConfirmationService,
    @Optional() private readonly channelNotesService?: ChannelNotesService,
    @Optional() private readonly learnedFactsService?: LearnedFactsService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const rawQuery = context.toolArgs?.query;
    const query = collapseWhitespace(typeof rawQuery === 'string' ? rawQuery : '');
    if (!query) {
      await this.zcaMessenger.sendMessage(context.chatId, 'Bạn muốn mình quên điều gì?');
      return;
    }
    const notes = this.channelNotesService
      ? await this.channelNotesService.findMatching(context.chatId, query)
      : [];
    const facts = this.learnedFactsService
      ? await this.learnedFactsService.findMatching(context.chatId, query)
      : [];
    const items = [
      ...notes.map((note) => ({ kind: 'note' as const, id: note.id, text: note.text })),
      ...facts.map((fact) => ({
        kind: 'fact' as const,
        id: fact.id,
        text: fact.subjectKind === 'bot' ? fact.fact : `${fact.subjectName}: ${fact.fact}`,
      })),
    ].slice(0, FORGET_MAX_ITEMS);
    if (items.length === 0) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `Mình không nhớ điều gì khớp với "${query}".`,
      );
      return;
    }

    try {
      await this.confirmationService.createPendingForgetMemory({
        userId: context.senderId,
        chatId: context.chatId,
        payload: {
          query,
          noteIds: items.filter((item) => item.kind === 'note').map((item) => item.id),
          factIds: items.filter((item) => item.kind === 'fact').map((item) => item.id),
          items: items.map((item) => item.text),
        },
        rawPrompt: context.text,
      });
    } catch (err: unknown) {
      this.logger.error(
        `Failed to create pending forget: ${err instanceof Error ? err.message : JSON.stringify(err)}`,
      );
      await this.zcaMessenger.sendMessage(context.chatId, '⚠️ Chưa quên được, thử lại sau.');
    }
  }
}

import { Injectable, Optional } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { ChannelNotesService } from '../../memory/channel-notes.service';
import { LearnedFactsService } from '../../memory/learned-facts.service';
import { collapseWhitespace } from '../../memory/memory-text.util';
import { toolReply } from './remember-note-tool.strategy';

/** Most items forgotten at once; a vaguer request is asked to be narrowed instead. */
export const FORGET_MAX_ITEMS = 5;

/**
 * `FORGET_MEMORY`: "quên vụ mèo đen đi". Forgets at once the chat's notes and learned facts that
 * contain every keyword (deleted learned facts are not learned again), then answers with the
 * LLM's in-character `reply` or a line listing what was forgotten. Not written to memory: the
 * forgotten words would be learned again from it.
 */
@Injectable()
export class ForgetMemoryToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.FORGET_MEMORY;

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
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
    const total = notes.length + facts.length;
    if (total === 0) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `Mình không nhớ điều gì khớp với "${query}".`,
      );
      return;
    }
    if (total > FORGET_MAX_ITEMS) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        `Có ${total} điều khớp với "${query}", nói rõ hơn điều nào cần quên nhé.`,
      );
      return;
    }

    await this.channelNotesService?.remove(
      context.chatId,
      notes.map((note) => note.id),
    );
    await this.learnedFactsService?.remove(
      context.chatId,
      facts.map((fact) => fact.id),
      context.senderId,
    );
    const items = [
      ...notes.map((note) => note.text),
      ...facts.map((fact) =>
        fact.subjectKind === 'bot' ? fact.fact : `${fact.subjectName}: ${fact.fact}`,
      ),
    ];
    await this.zcaMessenger.sendMessage(
      context.chatId,
      toolReply(context.toolArgs, `Dạ em quên rồi: ${items.map((item) => `"${item}"`).join('; ')}`),
    );
  }
}

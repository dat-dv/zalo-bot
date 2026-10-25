import { Injectable, Logger, Optional } from '@nestjs/common';
import { CHANNEL_NOTES_LIMITS } from '@zalobot/contracts';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { TransactionConfirmationService } from '../../confirmation/transaction-confirmation.service';
import { ChannelNotesService, channelNoteRejectionText } from '../../memory/channel-notes.service';
import { collapseWhitespace, foldVietnamese } from '../../memory/memory-text.util';
import type { ZcaChannelNoteEntity } from '../../../database/entities/zca-channel-note.entity';

/** `n2`, `[n2]` → the second note of the chat (the prompt lists notes oldest first). */
export function noteByShortId(
  notes: readonly ZcaChannelNoteEntity[],
  shortId: unknown,
): ZcaChannelNoteEntity | undefined {
  if (typeof shortId !== 'string') return undefined;
  const match = /^\[?n(\d+)\]?$/i.exec(shortId.trim());
  if (!match) return undefined;
  return notes[Number(match[1]) - 1];
}

/**
 * `REMEMBER_NOTE`: a member tells the bot to always remember something in this chat ("từ giờ
 * mày là con mèo đen 2 mái"). Like every change it waits for confirmation on a card; once
 * approved the note is part of every prompt of the chat.
 */
@Injectable()
export class RememberNoteToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.REMEMBER_NOTE;
  private readonly logger = new Logger(RememberNoteToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly confirmationService: TransactionConfirmationService,
    @Optional() private readonly channelNotesService?: ChannelNotesService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    if (!this.channelNotesService) return;
    const rawText = context.toolArgs?.text;
    const text = collapseWhitespace(typeof rawText === 'string' ? rawText : '');
    if (!text) {
      await this.zcaMessenger.sendMessage(context.chatId, channelNoteRejectionText('empty'));
      return;
    }
    if (text.length > CHANNEL_NOTES_LIMITS.MAX_CHARS) {
      await this.zcaMessenger.sendMessage(context.chatId, channelNoteRejectionText('too_long'));
      return;
    }

    const notes = await this.channelNotesService.list(context.chatId);
    if (notes.some((note) => foldVietnamese(note.text) === foldVietnamese(text))) {
      await this.zcaMessenger.sendMessage(context.chatId, `Mình nhớ điều này rồi: "${text}".`);
      return;
    }
    const replaced = noteByShortId(notes, context.toolArgs?.replaceNoteId);
    if (!replaced && notes.length >= CHANNEL_NOTES_LIMITS.MAX_NOTES) {
      await this.zcaMessenger.sendMessage(context.chatId, channelNoteRejectionText('limit'));
      return;
    }

    try {
      await this.confirmationService.createPendingRememberNote({
        userId: context.senderId,
        chatId: context.chatId,
        payload: {
          text,
          replaceNoteId: replaced?.id,
          replaceNoteText: replaced?.text,
        },
        rawPrompt: context.text,
        messageId: context.input.messageId,
      });
    } catch (err: unknown) {
      this.logger.error(
        `Failed to create pending note: ${err instanceof Error ? err.message : JSON.stringify(err)}`,
      );
      await this.zcaMessenger.sendMessage(context.chatId, '⚠️ Chưa ghi nhớ được, thử lại sau.');
    }
  }
}

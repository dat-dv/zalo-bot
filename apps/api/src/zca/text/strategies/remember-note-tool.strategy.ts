import { Injectable, Logger, Optional } from '@nestjs/common';
import { CHANNEL_NOTES_LIMITS } from '@zalobot/contracts';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { ThreadConfigService } from '../../thread-config.service';
import { ChannelNotesService, channelNoteRejectionText } from '../../memory/channel-notes.service';
import { ChatMemoryService } from '../../memory/chat-memory.service';
import { recordDoneAction } from '../../memory/action-memory';
import { collapseWhitespace, foldVietnamese } from '../../memory/memory-text.util';
import type { ZcaChannelNoteEntity } from '../../../database/entities/zca-channel-note.entity';

/** Longest reply sent; the LLM is asked for one short sentence. */
export const NOTE_REPLY_MAX_LENGTH = 500;

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

/** The LLM's in-character reply, or `fallback` when it wrote none. */
export function toolReply(args: Record<string, unknown> | undefined, fallback: string): string {
  const reply = args?.reply;
  const text = typeof reply === 'string' ? reply.trim() : '';
  return (text || fallback).slice(0, NOTE_REPLY_MAX_LENGTH);
}

/**
 * `REMEMBER_NOTE`: a member tells the bot to always remember something in this chat ("mày là con
 * mèo đen 2 mái"). Saved at once, no confirmation card: a note only changes how the bot talks and
 * can be removed with "quên vụ … đi" or on the dashboard. The bot answers with the LLM's
 * in-character `reply`, so it reads like conversation ("dạ em nhớ rồi…").
 */
@Injectable()
export class RememberNoteToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.REMEMBER_NOTE;
  private readonly logger = new Logger(RememberNoteToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    @Optional() private readonly channelNotesService?: ChannelNotesService,
    @Optional() private readonly threadConfigService?: ThreadConfigService,
    @Optional() private readonly chatMemoryService?: ChatMemoryService,
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
    const reply = toolReply(context.toolArgs, `Dạ em nhớ rồi: ${text}`);

    const notes = await this.channelNotesService.list(context.chatId);
    // Already remembered: nothing to save, but the member still gets the answer they expect.
    if (notes.some((note) => foldVietnamese(note.text) === foldVietnamese(text))) {
      await this.zcaMessenger.sendMessage(context.chatId, reply);
      return;
    }
    const replaced = noteByShortId(notes, context.toolArgs?.replaceNoteId);
    const result = replaced
      ? await this.channelNotesService.update(context.chatId, replaced.id, text)
      : await this.channelNotesService.add(context.chatId, text, {
          createdBy: context.senderId,
          sourceMsgId: context.input.messageId ?? null,
        });
    if ('reason' in result) {
      await this.zcaMessenger.sendMessage(context.chatId, channelNoteRejectionText(result.reason));
      return;
    }

    await this.zcaMessenger.sendMessage(context.chatId, reply);
    await recordDoneAction(
      { threadConfigs: this.threadConfigService, chatMemory: this.chatMemoryService },
      {
        chatId: context.chatId,
        actionId: `action:note:${result.note.id}:${result.note.updatedAt.getTime()}`,
        requesterUid: context.senderId,
        requesterName: context.displayName || null,
        text: `(đã duyệt) Đã ghi nhớ: ${result.note.text}`,
      },
    ).catch((err: unknown) => {
      this.logger.warn(
        `Could not record note in memory: ${err instanceof Error ? err.message : JSON.stringify(err)}`,
      );
    });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CHANNEL_NOTES_LIMITS } from '@zalobot/contracts';
import { In, Repository } from 'typeorm';
import { ZcaChannelNoteEntity } from '../../database/entities/zca-channel-note.entity';
import { collapseWhitespace, matchesAllWords } from './memory-text.util';

export type ChannelNoteRejection = 'empty' | 'too_long' | 'limit' | 'not_found';

/** `reason` is set exactly when the change was refused (checked with `'reason' in result`). */
export type ChannelNoteResult = { note: ZcaChannelNoteEntity } | { reason: ChannelNoteRejection };

/** Vietnamese reason shown in chat and on the dashboard. */
export function channelNoteRejectionText(reason: ChannelNoteRejection): string {
  switch (reason) {
    case 'empty':
      return 'Nội dung ghi nhớ đang trống.';
    case 'too_long':
      return `Mỗi điều ghi nhớ tối đa ${CHANNEL_NOTES_LIMITS.MAX_CHARS} ký tự.`;
    case 'limit':
      return `Kênh đã đủ ${CHANNEL_NOTES_LIMITS.MAX_NOTES} điều ghi nhớ, hãy xoá bớt trước.`;
    case 'not_found':
      return 'Không tìm thấy điều ghi nhớ này.';
  }
}

/**
 * What a chat told the bot to always remember (Ghi nhớ). Every note of a chat goes into every
 * prompt of that chat, ahead of the default persona, so the list is capped.
 */
@Injectable()
export class ChannelNotesService {
  private readonly logger = new Logger(ChannelNotesService.name);

  constructor(
    @InjectRepository(ZcaChannelNoteEntity)
    private readonly noteRepository: Repository<ZcaChannelNoteEntity>,
  ) {}

  /** Oldest first, so the short ids `[n1]…` in the prompt stay stable while notes are added. */
  public async list(channelId: string): Promise<ZcaChannelNoteEntity[]> {
    if (!channelId) return [];
    try {
      return await this.noteRepository.find({
        where: { channelId },
        order: { createdAt: 'ASC' },
      });
    } catch (err: unknown) {
      this.logger.warn(
        `[ChannelNotes] Could not read notes of ${channelId}: ${err instanceof Error ? err.message : JSON.stringify(err)}`,
      );
      return [];
    }
  }

  public async add(
    channelId: string,
    text: string,
    source: { createdBy?: string | null; sourceMsgId?: string | null } = {},
  ): Promise<ChannelNoteResult> {
    const clean = collapseWhitespace(text);
    const rejection = validateNoteText(clean);
    if (rejection) return { reason: rejection };
    const count = await this.noteRepository.count({ where: { channelId } });
    if (count >= CHANNEL_NOTES_LIMITS.MAX_NOTES) return { reason: 'limit' };
    const note = await this.noteRepository.save(
      this.noteRepository.create({
        channelId,
        text: clean,
        createdBy: source.createdBy ?? null,
        sourceMsgId: source.sourceMsgId ?? null,
      }),
    );
    return { note };
  }

  public async update(channelId: string, noteId: string, text: string): Promise<ChannelNoteResult> {
    const clean = collapseWhitespace(text);
    const rejection = validateNoteText(clean);
    if (rejection) return { reason: rejection };
    const note = await this.noteRepository.findOne({ where: { id: noteId, channelId } });
    if (!note) return { reason: 'not_found' };
    note.text = clean;
    return { note: await this.noteRepository.save(note) };
  }

  public async remove(channelId: string, noteIds: readonly string[]): Promise<number> {
    if (!channelId || noteIds.length === 0) return 0;
    const notes = await this.noteRepository.find({ where: { channelId, id: In([...noteIds]) } });
    if (notes.length === 0) return 0;
    // `remove` (not `delete`) so the audit log records what was forgotten.
    await this.noteRepository.remove(notes);
    return notes.length;
  }

  /** Notes whose text contains every word of `query` (accent-insensitive). */
  public async findMatching(channelId: string, query: string): Promise<ZcaChannelNoteEntity[]> {
    return (await this.list(channelId)).filter((note) => matchesAllWords(note.text, query));
  }
}

function validateNoteText(text: string): ChannelNoteRejection | null {
  if (!text) return 'empty';
  if (text.length > CHANNEL_NOTES_LIMITS.MAX_CHARS) return 'too_long';
  return null;
}

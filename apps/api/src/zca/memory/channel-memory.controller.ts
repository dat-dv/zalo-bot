import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  forwardRef,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  IChannelLearnedFact,
  IChannelMemoryStatus,
  IChannelNote,
  IUpsertChannelNoteRequest,
} from '@zalobot/contracts';
import type { Request } from 'express';
import type { ZcaChannelNoteEntity } from '../../database/entities/zca-channel-note.entity';
import type { ZcaLearnedFactEntity } from '../../database/entities/zca-learned-fact.entity';
import { requireDashboardAdmin } from '../../dashboard-auth/dashboard-user';
import { ReportsTokenService } from '../../reports/reports-token.service';
import { UsersService } from '../../users/users.service';
import {
  ChannelNotesService,
  channelNoteRejectionText,
  type ChannelNoteResult,
} from './channel-notes.service';
import { LearnedFactsService } from './learned-facts.service';
import { MemoryIngestService } from './long-term/memory-ingest.service';

function toNoteDto(note: ZcaChannelNoteEntity, names: ReadonlyMap<string, string>): IChannelNote {
  return {
    id: note.id,
    channelId: note.channelId,
    text: note.text,
    createdBy: note.createdBy ?? null,
    createdByName: note.createdBy ? (names.get(note.createdBy) ?? null) : null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

function toFactDto(fact: ZcaLearnedFactEntity): IChannelLearnedFact {
  return {
    id: fact.id,
    channelId: fact.channelId,
    subjectKind: fact.subjectKind,
    subjectUserId: fact.subjectUserId ?? null,
    subjectName: fact.subjectName,
    fact: fact.fact,
    learnedAt: fact.learnedAt.toISOString(),
  };
}

function noteText(body: IUpsertChannelNoteRequest | undefined): string {
  const text: unknown = body?.text;
  if (typeof text !== 'string') throw new BadRequestException('Thiếu nội dung ghi nhớ.');
  return text;
}

/**
 * Dashboard API of a chat's memory (admin only): the notes it always remembers (Ghi nhớ), what
 * the bot learned about the bot and the members, and where the nightly Cognee job stands.
 */
@ApiTags('zca')
@ApiBearerAuth('bearer-jwt')
@Controller('zca')
export class ChannelMemoryController {
  constructor(
    private readonly notes: ChannelNotesService,
    private readonly facts: LearnedFactsService,
    private readonly ingest: MemoryIngestService,
    private readonly tokens: ReportsTokenService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  @Get('threads/:threadId/notes')
  @ApiOperation({ summary: 'Những điều kênh dặn bot luôn nhớ (Ghi nhớ)' })
  public async listNotes(
    @Req() req: Request,
    @Param('threadId') threadId: string,
  ): Promise<{ data: { notes: IChannelNote[] } }> {
    this.admin(req);
    return { data: { notes: await this.noteDtos(threadId) } };
  }

  @Post('threads/:threadId/notes')
  @ApiOperation({ summary: 'Thêm một điều ghi nhớ cho kênh' })
  public async createNote(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Body() body?: IUpsertChannelNoteRequest,
  ): Promise<{ data: { notes: IChannelNote[] } }> {
    const adminId = String(this.admin(req));
    this.unwrap(await this.notes.add(threadId, noteText(body), { createdBy: adminId }));
    return { data: { notes: await this.noteDtos(threadId) } };
  }

  @Patch('threads/:threadId/notes/:noteId')
  @ApiOperation({ summary: 'Sửa một điều ghi nhớ của kênh' })
  public async updateNote(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Param('noteId') noteId: string,
    @Body() body?: IUpsertChannelNoteRequest,
  ): Promise<{ data: { notes: IChannelNote[] } }> {
    this.admin(req);
    this.unwrap(await this.notes.update(threadId, noteId, noteText(body)));
    return { data: { notes: await this.noteDtos(threadId) } };
  }

  @Delete('threads/:threadId/notes/:noteId')
  @ApiOperation({ summary: 'Xoá một điều ghi nhớ của kênh' })
  public async deleteNote(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Param('noteId') noteId: string,
  ): Promise<{ data: { notes: IChannelNote[] } }> {
    this.admin(req);
    if ((await this.notes.remove(threadId, [noteId])) === 0) {
      throw new NotFoundException(channelNoteRejectionText('not_found'));
    }
    return { data: { notes: await this.noteDtos(threadId) } };
  }

  @Get('threads/:threadId/learned-facts')
  @ApiOperation({ summary: 'Những điều bot tự rút ra về bot và các thành viên của kênh' })
  public async listFacts(
    @Req() req: Request,
    @Param('threadId') threadId: string,
  ): Promise<{ data: { facts: IChannelLearnedFact[] } }> {
    this.admin(req);
    return { data: { facts: (await this.facts.listActive(threadId)).map(toFactDto) } };
  }

  @Delete('threads/:threadId/learned-facts/:factId')
  @ApiOperation({ summary: 'Xoá một điều bot tự rút ra (không học lại nữa)' })
  public async deleteFact(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Param('factId') factId: string,
  ): Promise<{ data: { facts: IChannelLearnedFact[] } }> {
    const adminId = String(this.admin(req));
    if ((await this.facts.remove(threadId, [factId], adminId)) === 0) {
      throw new NotFoundException('Không tìm thấy điều bot đã học này.');
    }
    return { data: { facts: (await this.facts.listActive(threadId)).map(toFactDto) } };
  }

  @Get('threads/:threadId/memory-status')
  @ApiOperation({ summary: 'Trạng thái nạp trí nhớ dài hạn (Cognee) của kênh' })
  public async memoryStatus(
    @Req() req: Request,
    @Param('threadId') threadId: string,
  ): Promise<{ data: { status: IChannelMemoryStatus } }> {
    this.admin(req);
    return { data: { status: await this.ingest.status(threadId) } };
  }

  private async noteDtos(threadId: string): Promise<IChannelNote[]> {
    const notes = await this.notes.list(threadId);
    const ids = notes
      .map((note) => note.createdBy)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    const names = await this.usersService
      .resolveZaloNames(ids)
      .catch(() => new Map<string, string>());
    return notes.map((note) => toNoteDto(note, names));
  }

  private unwrap(result: ChannelNoteResult): void {
    if (!('reason' in result)) return;
    if (result.reason === 'not_found') {
      throw new NotFoundException(channelNoteRejectionText(result.reason));
    }
    throw new BadRequestException(channelNoteRejectionText(result.reason));
  }

  private admin(req: Request): string | number {
    return requireDashboardAdmin(req, this.tokens, this.usersService);
  }
}

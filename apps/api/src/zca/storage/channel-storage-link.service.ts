import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ChannelStorageLinkEntity,
  type ChannelStorageLinkKind,
} from '../../database/entities/channel-storage-link.entity';

export interface ChannelStorageLinkInput {
  threadId: string;
  kind: ChannelStorageLinkKind;
  googleEmail: string | null;
  resourceId: string;
  url: string;
  label: string;
  usedAt?: Date;
}

/** History of the Drive root folders and Photos albums each channel's media went to. */
@Injectable()
export class ChannelStorageLinkService {
  constructor(
    @InjectRepository(ChannelStorageLinkEntity)
    private readonly linkRepository: Repository<ChannelStorageLinkEntity>,
  ) {}

  /**
   * Upserts a link and bumps its `last_used_at`. A backfilled row (no Google account) adopts the
   * account of the first upload that hits it.
   */
  public async record(input: ChannelStorageLinkInput): Promise<void> {
    const usedAt = input.usedAt ?? new Date();
    await this.linkRepository.query(
      `INSERT INTO "channel_storage_links"
         ("thread_id", "kind", "google_email", "resource_id", "url", "label", "first_used_at", "last_used_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       ON CONFLICT ("thread_id", "kind", "resource_id") DO UPDATE SET
         "url" = EXCLUDED."url",
         "label" = EXCLUDED."label",
         "google_email" = COALESCE("channel_storage_links"."google_email", EXCLUDED."google_email"),
         "last_used_at" = GREATEST("channel_storage_links"."last_used_at", EXCLUDED."last_used_at")`,
      [
        input.threadId,
        input.kind,
        input.googleEmail,
        input.resourceId,
        input.url,
        input.label,
        usedAt,
      ],
    );
  }

  /** The channel's album with this title in this Google account, if one was recorded. */
  public async findAlbum(
    threadId: string,
    googleEmail: string,
    title: string,
  ): Promise<ChannelStorageLinkEntity | null> {
    return this.linkRepository.findOne({
      where: { threadId, kind: 'photos', googleEmail, label: title },
      order: { lastUsedAt: 'DESC' },
    });
  }

  public async listForThread(threadId: string): Promise<ChannelStorageLinkEntity[]> {
    return this.linkRepository.find({
      where: { threadId },
      order: { lastUsedAt: 'DESC' },
    });
  }
}

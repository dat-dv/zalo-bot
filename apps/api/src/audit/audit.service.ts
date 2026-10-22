import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AUDIT_LOG_DEFAULT_LIMIT,
  AUDIT_TECHNICAL_TABLES,
  type IAuditLogActorFacet,
  type IAuditLogDetail,
  type IAuditLogListItem,
  type IAuditLogListQuery,
  type IAuditLogListResponse,
} from '@zalobot/contracts';
import { Brackets, In, Repository, type SelectQueryBuilder } from 'typeorm';
import { AuditLogEntity } from '../database/entities/audit-log.entity';
import { UserEntity } from '../database/entities/user.entity';
import { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import { DASHBOARD_OWNER_USER_ID } from '../users/dashboard-owner';
import { computeChangedFields } from './audit-log-query';

interface AuditLookups {
  userNames: Map<string, string>;
  chats: Map<string, { name: string; type: 'group' | 'user' }>;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity) private readonly auditRepo: Repository<AuditLogEntity>,
    @Optional()
    @InjectRepository(UserEntity)
    private readonly userRepo?: Repository<UserEntity>,
    @Optional()
    @InjectRepository(ZcaThreadConfigEntity)
    private readonly threadConfigRepo?: Repository<ZcaThreadConfigEntity>,
  ) {}

  public listRecent(userId: number | string, limit = 20): Promise<AuditLogEntity[]> {
    return this.auditRepo.find({
      where: { actorId: userId.toString() },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /** Newest-first page of the activity log for the admin page. */
  public async list(query: IAuditLogListQuery): Promise<IAuditLogListResponse> {
    const limit = query.limit ?? AUDIT_LOG_DEFAULT_LIMIT;
    const offset = query.offset ?? 0;
    const builder = this.auditRepo.createQueryBuilder('log');
    applyListFilters(builder, query);
    const [[rows, total], actorIds] = await Promise.all([
      builder
        .orderBy('log.createdAt', 'DESC')
        .addOrderBy('log.id', 'DESC')
        .skip(offset)
        .take(limit)
        .getManyAndCount(),
      this.distinctActorIds(),
    ]);
    const lookups = await this.lookups(
      [...actorIds, ...rows.map((row) => row.actorId)],
      rows.map((row) => row.channelId),
    );
    return {
      items: rows.map((row) => toListItem(row, lookups)),
      total,
      limit,
      offset,
      facets: {
        actors: actorIds.map((id): IAuditLogActorFacet => ({
          id,
          name: lookups.userNames.get(id) ?? '',
          isOwner: id === DASHBOARD_OWNER_USER_ID,
        })),
      },
    };
  }

  public async get(id: string): Promise<IAuditLogDetail | null> {
    const row = await this.auditRepo.findOne({ where: { id } });
    if (!row) return null;
    const lookups = await this.lookups([row.actorId], [row.channelId]);
    return {
      ...toListItem(row, lookups),
      beforeData: row.beforeData ?? null,
      afterData: row.afterData ?? null,
    };
  }

  private async distinctActorIds(): Promise<string[]> {
    const rows = await this.auditRepo
      .createQueryBuilder('log')
      .select('DISTINCT log.actor_id', 'actorId')
      .where('log.actor_id IS NOT NULL')
      .getRawMany<{ actorId: string }>();
    return rows.map((row) => row.actorId).sort();
  }

  /** Names of the actors and chats on a page, one query each. */
  private async lookups(
    actorIds: ReadonlyArray<string | null | undefined>,
    channelIds: ReadonlyArray<string | null | undefined>,
  ): Promise<AuditLookups> {
    const userIds = [...new Set(actorIds.filter((id): id is string => !!id))];
    const chatIds = [...new Set(channelIds.filter((id): id is string => !!id))];
    const [users, chats] = await Promise.all([
      userIds.length && this.userRepo
        ? this.userRepo.find({ where: { id: In(userIds) }, select: { id: true, firstName: true } })
        : Promise.resolve<UserEntity[]>([]),
      chatIds.length && this.threadConfigRepo
        ? this.threadConfigRepo.find({
            where: { threadId: In(chatIds) },
            select: { threadId: true, threadName: true, threadType: true },
          })
        : Promise.resolve<ZcaThreadConfigEntity[]>([]),
    ]);
    return {
      userNames: new Map(
        users.flatMap((user): [string, string][] => {
          const name = user.firstName?.trim();
          return name ? [[user.id, name]] : [];
        }),
      ),
      chats: new Map(
        chats.map((chat) => [
          chat.threadId,
          {
            name: chat.threadName?.trim() ?? '',
            type: chat.threadType === 'group' ? 'group' : 'user',
          },
        ]),
      ),
    };
  }
}

function applyListFilters(
  builder: SelectQueryBuilder<AuditLogEntity>,
  query: IAuditLogListQuery,
): void {
  if (query.tables?.length) {
    builder.andWhere('log.tableName IN (:...tables)', { tables: query.tables });
  } else if (!query.includeTechnical) {
    builder.andWhere('log.tableName NOT IN (:...technical)', {
      technical: [...AUDIT_TECHNICAL_TABLES],
    });
  }
  if (query.actions?.length)
    builder.andWhere('log.action IN (:...actions)', { actions: query.actions });
  if (query.sources?.length) {
    const sources = query.sources.filter((source) => source !== 'legacy');
    const legacy = query.sources.includes('legacy');
    builder.andWhere(
      new Brackets((where) => {
        if (sources.length) where.orWhere('log.actorSource IN (:...sources)', { sources });
        if (legacy) where.orWhere('log.actorSource IS NULL');
      }),
    );
  }
  if (query.actorIds?.length)
    builder.andWhere('log.actorId IN (:...actorIds)', { actorIds: query.actorIds });
  if (query.recordId) builder.andWhere('log.recordId = :recordId', { recordId: query.recordId });
  if (query.startAt) builder.andWhere('log.createdAt >= :startAt', { startAt: query.startAt });
  if (query.endAt) builder.andWhere('log.createdAt <= :endAt', { endAt: query.endAt });
}

function toListItem(row: AuditLogEntity, lookups: AuditLookups): IAuditLogListItem {
  const chat = row.channelId ? lookups.chats.get(row.channelId) : undefined;
  return {
    id: row.id,
    tableName: row.tableName,
    recordId: row.recordId || null,
    action: row.action,
    actorId: row.actorId ?? null,
    actorName: row.actorId ? (lookups.userNames.get(row.actorId) ?? '') : '',
    actorIsOwner: row.actorId === DASHBOARD_OWNER_USER_ID,
    actorSource: row.actorSource ?? null,
    channelId: row.channelId ?? null,
    channelName: chat?.name ?? '',
    channelType: chat?.type ?? null,
    changedFields: computeChangedFields(row.action, row.beforeData, row.afterData),
    createdAt: row.createdAt.toISOString(),
  };
}

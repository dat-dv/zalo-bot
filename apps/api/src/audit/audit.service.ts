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
import { Brackets, In, Not, Repository, type SelectQueryBuilder } from 'typeorm';
import { AuditLogEntity } from '../database/entities/audit-log.entity';
import { UserEntity } from '../database/entities/user.entity';
import { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import { DASHBOARD_OWNER_USER_ID } from '../users/dashboard-owner';
import { computeChangedFields } from './audit-log-query';

/** Display names of user ids from a source outside this module (the ZCA directory). */
export type AuditNameResolver = (ids: string[]) => Promise<Map<string, string>>;

interface AuditLookups {
  /** From the ZCA directory: the name the admin sees everywhere else on the dashboard. */
  zaloNames: Map<string, string>;
  /** `users.first_name`, the last resort. */
  userNames: Map<string, string>;
  chats: Map<string, { name: string; type: 'group' | 'user' }>;
}

interface ActorRow {
  actorId: string;
  /** One name saved on the actor's rows (see `actor_name`), if any. */
  actorName: string | null;
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

  /** The home page's recent activity; sign-ins and reminder bookkeeping would crowd it out. */
  public listRecent(userId: number | string, limit = 20): Promise<AuditLogEntity[]> {
    return this.auditRepo.find({
      where: { actorId: userId.toString(), tableName: Not(In([...AUDIT_TECHNICAL_TABLES])) },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /** Newest-first page of the activity log for the admin page. */
  public async list(
    query: IAuditLogListQuery,
    resolveNames?: AuditNameResolver,
  ): Promise<IAuditLogListResponse> {
    const limit = query.limit ?? AUDIT_LOG_DEFAULT_LIMIT;
    const offset = query.offset ?? 0;
    const builder = this.auditRepo.createQueryBuilder('log');
    applyListFilters(builder, query);
    const [[rows, total], actors] = await Promise.all([
      builder
        .orderBy('log.createdAt', 'DESC')
        .addOrderBy('log.id', 'DESC')
        .skip(offset)
        .take(limit)
        .getManyAndCount(),
      this.distinctActors(),
    ]);
    const lookups = await this.lookups(
      [...actors.map((actor) => actor.actorId), ...rows.map((row) => row.actorId)],
      rows.map((row) => row.channelId),
      resolveNames,
    );
    return {
      items: rows.map((row) => toListItem(row, lookups)),
      total,
      limit,
      offset,
      facets: {
        actors: actors.map((actor): IAuditLogActorFacet => ({
          id: actor.actorId,
          name: actorNameOf(actor.actorId, actor.actorName, lookups),
          isOwner: actor.actorId === DASHBOARD_OWNER_USER_ID,
        })),
      },
    };
  }

  public async get(id: string, resolveNames?: AuditNameResolver): Promise<IAuditLogDetail | null> {
    const row = await this.auditRepo.findOne({ where: { id } });
    if (!row) return null;
    const lookups = await this.lookups([row.actorId], [row.channelId], resolveNames);
    return {
      ...toListItem(row, lookups),
      beforeData: row.beforeData ?? null,
      afterData: row.afterData ?? null,
    };
  }

  private async distinctActors(): Promise<ActorRow[]> {
    const rows = await this.auditRepo
      .createQueryBuilder('log')
      .select('log.actor_id', 'actorId')
      .addSelect('MAX(log.actor_name)', 'actorName')
      .where('log.actor_id IS NOT NULL')
      .groupBy('log.actor_id')
      .getRawMany<ActorRow>();
    return rows.sort((a, b) => a.actorId.localeCompare(b.actorId));
  }

  /** Names of the actors and chats on a page, one query each. */
  private async lookups(
    actorIds: ReadonlyArray<string | null | undefined>,
    channelIds: ReadonlyArray<string | null | undefined>,
    resolveNames?: AuditNameResolver,
  ): Promise<AuditLookups> {
    const userIds = [...new Set(actorIds.filter((id): id is string => !!id))];
    const chatIds = [...new Set(channelIds.filter((id): id is string => !!id))];
    const [zaloNames, users, chats] = await Promise.all([
      userIds.length && resolveNames
        ? resolveNames(userIds).catch(() => new Map<string, string>())
        : Promise.resolve(new Map<string, string>()),
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
      zaloNames,
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
    actorName: row.actorId ? actorNameOf(row.actorId, row.actorName, lookups) : '',
    actorIsOwner: row.actorId === DASHBOARD_OWNER_USER_ID,
    actorSource: row.actorSource ?? null,
    channelId: row.channelId ?? null,
    channelName: chat?.name ?? '',
    channelType: chat?.type ?? null,
    changedFields: computeChangedFields(row.action, row.beforeData, row.afterData),
    createdAt: row.createdAt.toISOString(),
  };
}

/** Directory name first, then the name saved when the change was made, then `first_name`. */
function actorNameOf(
  actorId: string,
  savedName: string | null | undefined,
  lookups: AuditLookups,
): string {
  return (
    lookups.zaloNames.get(actorId) || savedName?.trim() || lookups.userNames.get(actorId) || ''
  );
}

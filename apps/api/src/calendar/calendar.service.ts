import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { CalendarEventSource } from '@zalobot/contracts';
import { In, IsNull, Repository } from 'typeorm';
import { CalendarEventEntity } from '../database/entities/calendar-event.entity';
import { UserEntity } from '../database/entities/user.entity';
import { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import { GoogleAuthService } from '../google/google-auth.service';
import { GoogleCalendarService } from '../google/google-calendar.service';
import { RedisService } from '../redis/redis.service';
import {
  type CalendarEventFields,
  type CalendarItemLookups,
  differsFromRow,
  fromGoogleEvent,
  toCalendarEventItem,
  toGoogleEventBody,
} from './calendar-event.mapper';

/** Who is acting; `userId` also picks the Google account (own token, else the shared one). */
export interface CalendarActor {
  userId?: string;
  name?: string;
  chatId?: string;
  source: Exclude<CalendarEventSource, 'google'>;
}

export interface CalendarEventInput {
  title: string;
  description?: string | null;
  location?: string | null;
  startAt: Date;
  endAt: Date;
  allDay?: boolean;
  timeZone?: string;
  reminderMinutes?: number[];
}

export type CalendarEventPatch = Partial<CalendarEventInput>;

export interface CalendarListOptions {
  timeMin: Date;
  timeMax?: Date;
  query?: string;
  limit?: number;
  /** Import this viewer's Google account into the DB first (throttled). */
  importForUserId?: string;
}

export const DEFAULT_REMINDER_MINUTES = [60, 30, 10, 0];
const DAY_MS = 86_400_000;
// Re-reading the same Google range more often than this only costs API quota.
const IMPORT_THROTTLE_MS = 5 * 60_000;
const INITIAL_IMPORT_DAYS = 365;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function googleStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const { code, status, response } = err as {
    code?: unknown;
    status?: unknown;
    response?: { status?: unknown };
  };
  for (const value of [response?.status, status, code]) {
    if (typeof value === 'number') return value;
  }
  return undefined;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === 'string' ? err : 'Unknown error';
}

/**
 * The system calendar. Events live in `calendar_events` (shared by everyone, like the
 * finance ledger); Google Calendar keeps a copy in whichever account was connected when the
 * event was written. Reads come from the DB, after importing the viewer's Google account so
 * events made directly in Google show up and stay once seen.
 */
@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private readonly recentImports = new Map<string, number>();
  private readonly runningImports = new Map<string, Promise<void>>();

  constructor(
    @InjectRepository(CalendarEventEntity)
    private readonly eventRepo: Repository<CalendarEventEntity>,
    private readonly google: GoogleCalendarService,
    private readonly googleAuth: GoogleAuthService,
    private readonly config: ConfigService,
    @Optional() private readonly redis?: RedisService,
    @Optional()
    @InjectRepository(UserEntity)
    private readonly userRepo?: Repository<UserEntity>,
    @Optional()
    @InjectRepository(ZcaThreadConfigEntity)
    private readonly threadConfigRepo?: Repository<ZcaThreadConfigEntity>,
  ) {}

  private get defaultTimeZone(): string {
    return this.config.get<string>('timezone') || 'Asia/Ho_Chi_Minh';
  }

  public async listEvents(options: CalendarListOptions): Promise<CalendarEventEntity[]> {
    if (options.importForUserId !== undefined) {
      await this.importFromGoogle(
        options.importForUserId,
        options.timeMin,
        options.timeMax ?? new Date(options.timeMin.getTime() + 31 * DAY_MS),
      );
    }
    const qb = this.eventRepo
      .createQueryBuilder('event')
      .where('event.deleted_at IS NULL')
      // Overlap, so multi-day events show on every day they cover.
      .andWhere('event.end_at > :timeMin', { timeMin: options.timeMin });
    if (options.timeMax) qb.andWhere('event.start_at < :timeMax', { timeMax: options.timeMax });
    const query = options.query?.trim();
    if (query) {
      qb.andWhere(
        '(event.title ILIKE :q OR event.location ILIKE :q OR event.description ILIKE :q)',
        { q: `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%` },
      );
    }
    return qb
      .orderBy('event.start_at', 'ASC')
      .take(options.limit ?? 500)
      .getMany();
  }

  /** By row id; also accepts a Google event id (bot delete actions queued before the DB move). */
  public async getEvent(id: string): Promise<CalendarEventEntity> {
    const row = UUID_PATTERN.test(id)
      ? await this.eventRepo.findOne({ where: { id, deletedAt: IsNull() } })
      : await this.eventRepo.findOne({ where: { googleEventId: id, deletedAt: IsNull() } });
    if (!row) throw new NotFoundException('Không tìm thấy sự kiện lịch.');
    return row;
  }

  public async createEvent(
    input: CalendarEventInput,
    actor: CalendarActor,
  ): Promise<CalendarEventEntity> {
    const row = this.eventRepo.create({
      ...this.normalize(input),
      createdByUserId: actor.userId ?? null,
      createdByName: actor.name?.trim() || null,
      source: actor.source,
      sourceChatId: actor.chatId ?? null,
      syncStatus: this.googleAuth.isAuthorized(actor.userId) ? 'pending' : 'local',
    });
    const saved = await this.eventRepo.save(row);
    return this.pushToGoogle(saved, actor.userId);
  }

  public async updateEvent(
    id: string,
    patch: CalendarEventPatch,
    actorId?: string,
  ): Promise<CalendarEventEntity> {
    const row = await this.getEvent(id);
    const merged = this.normalize({
      title: patch.title ?? row.title,
      description: patch.description !== undefined ? patch.description : row.description,
      location: patch.location !== undefined ? patch.location : row.location,
      startAt: patch.startAt ?? row.startAt,
      endAt: patch.endAt ?? row.endAt,
      allDay: patch.allDay ?? row.allDay,
      timeZone: patch.timeZone ?? row.timeZone,
      reminderMinutes: patch.reminderMinutes ?? row.reminderMinutes,
    });
    Object.assign(row, merged);
    const saved = await this.eventRepo.save(row);
    return this.pushToGoogle(saved, actorId);
  }

  /** Soft delete; the Google copy is removed when its account is still connected. */
  public async deleteEvent(id: string, actorId?: string): Promise<CalendarEventEntity> {
    const row = await this.getEvent(id);
    row.deletedAt = new Date();
    const saved = await this.eventRepo.save(row);
    if (row.googleEventId) {
      const target = await this.resolveGoogleTarget(row.googleAccountEmail, actorId);
      if (target.reachable) {
        try {
          await this.google.deleteEvent(row.googleEventId, target.userId);
        } catch (err) {
          const status = googleStatus(err);
          // Already gone on Google (deleted there or never existed): nothing left to do.
          if (status !== 404 && status !== 410) {
            this.logger.warn(`Could not delete Google copy of ${row.id}: ${errorMessage(err)}`);
          }
        }
      }
    }
    return saved;
  }

  /** Retry writing the Google copy (after a failure, or to move it to the current account). */
  public async resyncEvent(id: string, actorId?: string): Promise<CalendarEventEntity> {
    return this.pushToGoogle(await this.getEvent(id), actorId);
  }

  /** DTOs with creator names, source chat names and whether the Google copy is reachable. */
  public async toItems(rows: readonly CalendarEventEntity[], viewerId?: string) {
    const lookups = await this.loadLookups(rows, viewerId);
    return rows.map((row) => toCalendarEventItem(row, lookups));
  }

  private normalize(input: CalendarEventInput): CalendarEventFields {
    const startAt = input.startAt;
    const endAt = input.endAt > startAt ? input.endAt : new Date(startAt.getTime() + 3_600_000);
    return {
      title: input.title.trim() || 'Cuộc hẹn',
      description: input.description?.trim() || null,
      location: input.location?.trim() || null,
      startAt,
      endAt,
      allDay: input.allDay ?? false,
      timeZone: input.timeZone?.trim() || this.defaultTimeZone,
      reminderMinutes: [...new Set(input.reminderMinutes ?? DEFAULT_REMINDER_MINUTES)]
        .filter((minutes) => Number.isInteger(minutes) && minutes >= 0)
        .sort((a, b) => b - a),
    };
  }

  /**
   * Write the row's Google copy. A copy in a still-connected account is patched; a copy in an
   * account the system lost access to is re-created in the actor's current account.
   */
  private async pushToGoogle(
    row: CalendarEventEntity,
    actorId?: string,
  ): Promise<CalendarEventEntity> {
    const body = toGoogleEventBody(row);
    if (row.googleEventId) {
      const target = await this.resolveGoogleTarget(row.googleAccountEmail, actorId);
      if (target.reachable) {
        return this.writeCopy(row, actorId, () =>
          this.google.patchEvent(row.googleEventId ?? '', body, target.userId),
        );
      }
    }
    if (!this.googleAuth.isAuthorized(actorId)) {
      // Keep pointing at the old copy if there is one; otherwise the event is app-only.
      if (!row.googleEventId && row.syncStatus !== 'local') {
        row.syncStatus = 'local';
        return this.eventRepo.save(row);
      }
      return row;
    }
    const email = await this.googleAuth.getAccountEmail(actorId);
    return this.writeCopy(row, actorId, async () => {
      const created = await this.google.insertEvent(body, actorId);
      row.googleEventId = created.id ?? null;
      row.googleAccountEmail = email;
      return created;
    });
  }

  private async writeCopy(
    row: CalendarEventEntity,
    actorId: string | undefined,
    write: () => Promise<unknown>,
  ): Promise<CalendarEventEntity> {
    try {
      await write();
      row.syncStatus = 'synced';
      row.syncedAt = new Date();
    } catch (err) {
      this.logger.warn(`Google Calendar sync failed for event ${row.id}: ${errorMessage(err)}`);
      if (actorId !== undefined) await this.googleAuth.handleAuthError(actorId, err);
      row.syncStatus = 'failed';
    }
    return this.eventRepo.save(row);
  }

  /** Which client reaches the Google account holding a copy: the actor's own, or the shared one. */
  private async resolveGoogleTarget(
    accountEmail: string | null | undefined,
    actorId?: string,
  ): Promise<{ reachable: boolean; userId?: string }> {
    if (!accountEmail) return { reachable: false };
    for (const candidate of [actorId, undefined]) {
      if (!this.googleAuth.isAuthorized(candidate)) continue;
      if ((await this.googleAuth.getAccountEmail(candidate)) === accountEmail) {
        return { reachable: true, userId: candidate };
      }
    }
    return { reachable: false };
  }

  /** Import the viewer's Google account for a range, at most once per range every few minutes. */
  private async importFromGoogle(viewerId: string, timeMin: Date, timeMax: Date): Promise<void> {
    if (!this.googleAuth.isAuthorized(viewerId)) return;
    let email: string | null;
    try {
      email = await this.googleAuth.getAccountEmail(viewerId);
    } catch {
      return;
    }
    if (!email) return;
    const accountEmail = email;

    const key = `${accountEmail}|${timeMin.toISOString()}|${timeMax.toISOString()}`;
    const last = this.recentImports.get(key);
    if (last !== undefined && Date.now() - last < IMPORT_THROTTLE_MS) return;

    // First time this account is seen: a year either side, so its past events are kept too.
    const initialKey = `calendar:initial-import:${accountEmail}`;
    if (!this.recentImports.has(initialKey) && !(await this.redis?.get(initialKey))) {
      const now = Date.now();
      const initialMin = new Date(now - INITIAL_IMPORT_DAYS * DAY_MS);
      const initialMax = new Date(now + INITIAL_IMPORT_DAYS * DAY_MS);
      if (await this.runImport(accountEmail, viewerId, initialMin, initialMax)) {
        this.recentImports.set(initialKey, now);
        await this.redis?.set(initialKey, new Date(now).toISOString());
        if (timeMin >= initialMin && timeMax <= initialMax) {
          this.recentImports.set(key, now);
          return;
        }
      }
    }

    if (await this.runImport(accountEmail, viewerId, timeMin, timeMax)) {
      this.recentImports.set(key, Date.now());
    }
  }

  /** One import per account and range at a time; concurrent callers wait for the same run. */
  private async runImport(
    accountEmail: string,
    viewerId: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<boolean> {
    const key = `${accountEmail}|${timeMin.toISOString()}|${timeMax.toISOString()}`;
    let running = this.runningImports.get(key);
    if (running === undefined) {
      running = this.importRange(accountEmail, viewerId, timeMin, timeMax).finally(() =>
        this.runningImports.delete(key),
      );
      this.runningImports.set(key, running);
    }
    try {
      await running;
      return true;
    } catch (err) {
      this.logger.warn(`Google Calendar import failed for ${accountEmail}: ${errorMessage(err)}`);
      await this.googleAuth.handleAuthError(viewerId, err);
      return false;
    }
  }

  /**
   * Upsert every Google event of the range, then soft-delete this account's rows in the range
   * that Google no longer returns (deleted in Google). Written without entity listeners so a
   * bulk import does not flood the audit log.
   */
  private async importRange(
    accountEmail: string,
    viewerId: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<void> {
    const remote = await this.google.listEventsInRange({ timeMin, timeMax }, viewerId);
    const remoteIds = remote.map((event) => event.id).filter((id): id is string => !!id);
    const known = new Map<string, CalendarEventEntity>();
    for (let i = 0; i < remoteIds.length; i += 500) {
      const rows = await this.eventRepo.find({
        where: { googleAccountEmail: accountEmail, googleEventId: In(remoteIds.slice(i, i + 500)) },
      });
      for (const row of rows) if (row.googleEventId) known.set(row.googleEventId, row);
    }

    const now = new Date();
    for (const event of remote) {
      if (!event.id) continue;
      const fields = fromGoogleEvent(event, this.defaultTimeZone);
      if (!fields) continue;
      const row = known.get(event.id);
      if (row) {
        // Deleted in zalobot: do not bring it back.
        if (row.deletedAt || !differsFromRow(row, fields)) continue;
        await this.eventRepo
          .createQueryBuilder()
          .update(CalendarEventEntity)
          .set({ ...fields, syncStatus: 'synced', syncedAt: now })
          .where('id = :id', { id: row.id })
          .callListeners(false)
          .execute();
        continue;
      }
      await this.eventRepo
        .createQueryBuilder()
        .insert()
        .into(CalendarEventEntity)
        .values({
          ...fields,
          source: 'google',
          googleEventId: event.id,
          googleAccountEmail: accountEmail,
          syncStatus: 'synced',
          syncedAt: now,
        })
        .orIgnore()
        .callListeners(false)
        .execute();
    }

    const vanished = this.eventRepo
      .createQueryBuilder()
      .update(CalendarEventEntity)
      .set({ deletedAt: now })
      .where('google_account_email = :accountEmail', { accountEmail })
      .andWhere('google_event_id IS NOT NULL')
      .andWhere('deleted_at IS NULL')
      .andWhere('start_at >= :timeMin AND start_at < :timeMax', { timeMin, timeMax });
    if (remoteIds.length)
      vanished.andWhere('google_event_id NOT IN (:...remoteIds)', { remoteIds });
    await vanished.callListeners(false).execute();
  }

  private async loadLookups(
    rows: readonly CalendarEventEntity[],
    viewerId?: string,
  ): Promise<CalendarItemLookups> {
    const creatorIds = [
      ...new Set(rows.map((row) => row.createdByUserId).filter((id): id is string => !!id)),
    ];
    const chatIds = [
      ...new Set(rows.map((row) => row.sourceChatId).filter((id): id is string => !!id)),
    ];
    const [users, chats, connectedEmails] = await Promise.all([
      creatorIds.length && this.userRepo
        ? this.userRepo.find({
            where: { id: In(creatorIds) },
            select: { id: true, firstName: true },
          })
        : Promise.resolve<UserEntity[]>([]),
      chatIds.length && this.threadConfigRepo
        ? this.threadConfigRepo.find({
            where: { threadId: In(chatIds) },
            select: { threadId: true, threadName: true, threadType: true },
          })
        : Promise.resolve<ZcaThreadConfigEntity[]>([]),
      this.connectedEmails(viewerId),
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
            name: chat.threadName?.trim() || undefined,
            type: chat.threadType === 'group' ? 'group' : 'user',
          },
        ]),
      ),
      connectedEmails,
    };
  }

  private async connectedEmails(viewerId?: string): Promise<Set<string>> {
    const emails = new Set<string>();
    for (const candidate of [viewerId, undefined]) {
      if (!this.googleAuth.isAuthorized(candidate)) continue;
      try {
        const email = await this.googleAuth.getAccountEmail(candidate);
        if (email) emails.add(email);
      } catch {
        // Unknown account: its events just show as "other account".
      }
    }
    return emails;
  }
}

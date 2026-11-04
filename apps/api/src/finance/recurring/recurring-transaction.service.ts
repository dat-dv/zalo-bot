import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  In,
  IsNull,
  LessThanOrEqual,
  type EntityManager,
  type Repository,
} from 'typeorm';
import type {
  ICreateRecurringRequest,
  IRecordOccurrenceRequest,
  IRecurringListResponse,
  IRecurringOccurrenceItem,
  IRecurringTransactionItem,
  IUpdateRecurringRequest,
} from '@zalobot/contracts';
import { FinanceTransactionEntity } from '../../database/entities/finance-transaction.entity';
import { RecurringOccurrenceEntity } from '../../database/entities/recurring-occurrence.entity';
import { RecurringTransactionEntity } from '../../database/entities/recurring-transaction.entity';
import { ZcaThreadConfigEntity } from '../../database/entities/zca-thread-config.entity';
import { nextOccurrence, upcomingTime } from '../../reminders/reminder-schedule';
import { FinanceService } from '../finance.service';
import { parseRecurringInput, type RecurringInput } from './recurring-input';

/** Bound on one scan of one rule; a longer gap finishes on the following scans. */
const MAX_CATCH_UP_PERIODS = 60;
const NOTIFY_BATCH = 50;

export interface OccurrenceActor {
  userId?: string;
  name?: string;
  source: 'zalo' | 'dashboard';
  chatId?: string;
}

function ruleRepeat(rule: RecurringTransactionEntity) {
  return { repeatType: rule.repeatType, repeatWeekdays: rule.repeatWeekdays };
}

@Injectable()
export class RecurringTransactionService {
  private readonly logger = new Logger(RecurringTransactionService.name);

  constructor(
    @InjectRepository(RecurringTransactionEntity)
    private readonly ruleRepo: Repository<RecurringTransactionEntity>,
    @InjectRepository(RecurringOccurrenceEntity)
    private readonly occurrenceRepo: Repository<RecurringOccurrenceEntity>,
    @InjectRepository(ZcaThreadConfigEntity)
    private readonly threadRepo: Repository<ZcaThreadConfigEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly finance: FinanceService,
  ) {}

  public async list(): Promise<IRecurringListResponse> {
    const [rules, pending] = await Promise.all([
      this.ruleRepo.find({
        relations: { place: true },
        order: { isActive: 'DESC', nextDueAt: 'ASC' },
      }),
      this.listDue(),
    ]);
    const chatIds = [...new Set(rules.flatMap((r) => (r.notifyChatId ? [r.notifyChatId] : [])))];
    const threads = chatIds.length
      ? await this.threadRepo.find({ where: { threadId: In(chatIds) } })
      : [];
    const names = new Map(threads.map((t) => [t.threadId, t.threadName]));
    return {
      rules: rules.map((rule) => this.toRuleItem(rule, names)),
      pending: pending.map((occurrence) => this.toOccurrenceItem(occurrence)),
    };
  }

  /** Periods waiting to be recorded or skipped, earliest first. */
  public async listPendingItems(): Promise<IRecurringOccurrenceItem[]> {
    const pending = await this.listDue();
    return pending.map((occurrence) => this.toOccurrenceItem(occurrence));
  }

  private toRuleItem(
    rule: RecurringTransactionEntity,
    chatNames: ReadonlyMap<string, string | undefined>,
  ): IRecurringTransactionItem {
    return {
      id: rule.id,
      type: rule.type,
      amount: rule.amount,
      category: rule.category,
      note: rule.note,
      placeName: rule.place?.name,
      repeatType: rule.repeatType,
      repeatWeekdays: rule.repeatWeekdays,
      mode: rule.mode,
      notifyChatId: rule.notifyChatId,
      notifyChatName: rule.notifyChatId ? chatNames.get(rule.notifyChatId) : undefined,
      isActive: rule.isActive,
      nextDueAt: rule.nextDueAt.toISOString(),
      createdByName: rule.createdByName ?? undefined,
    };
  }

  private toOccurrenceItem(occurrence: RecurringOccurrenceEntity): IRecurringOccurrenceItem {
    return {
      id: occurrence.id,
      ruleId: occurrence.ruleId,
      type: occurrence.rule?.type ?? 'expense',
      note: occurrence.rule?.note ?? '',
      category: occurrence.rule?.category ?? 'Khác',
      amount: occurrence.amount,
      dueAt: occurrence.dueAt.toISOString(),
    };
  }

  private listDue(): Promise<RecurringOccurrenceEntity[]> {
    return this.occurrenceRepo.find({
      where: { status: 'due' },
      relations: { rule: true },
      order: { dueAt: 'ASC' },
    });
  }

  /** A chat that is not listened would silently never hear anything. */
  private async assertListenedChat(chatId: string | null): Promise<void> {
    if (!chatId) return;
    const thread = await this.threadRepo.findOne({ where: { threadId: chatId, isListened: true } });
    if (!thread) throw new BadRequestException('Kênh nhận thông báo phải là kênh đang listen.');
  }

  private async placeIdFor(placeName?: string): Promise<string | null> {
    if (!placeName) return null;
    return (await this.finance.resolveOrCreatePlace(placeName))?.id ?? null;
  }

  private parse(body: Partial<ICreateRecurringRequest>): RecurringInput {
    try {
      return parseRecurringInput(body);
    } catch (err: unknown) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Dữ liệu không hợp lệ.');
    }
  }

  public async create(
    body: Partial<ICreateRecurringRequest>,
    creator: { userId?: string; name?: string },
    now: Date = new Date(),
  ): Promise<IRecurringTransactionItem> {
    const input = this.parse(body);
    await this.assertListenedChat(input.notifyChatId);
    // A start in the past begins at the next period: older periods were never asked for.
    const firstDue = upcomingTime(input.startAt, input, now);
    const saved = await this.ruleRepo.save(
      this.ruleRepo.create({
        type: input.type,
        amount: input.amount,
        category: input.category,
        note: input.note,
        placeId: await this.placeIdFor(input.placeName),
        repeatType: input.repeatType,
        repeatWeekdays: input.repeatWeekdays,
        anchorAt: firstDue,
        nextDueAt: firstDue,
        mode: input.mode,
        notifyChatId: input.notifyChatId,
        createdByUserId: creator.userId ?? null,
        createdByName: creator.name ?? null,
      }),
    );
    return this.toRuleItem(saved, new Map());
  }

  public async update(
    id: string,
    body: IUpdateRecurringRequest,
    now: Date = new Date(),
  ): Promise<IRecurringTransactionItem> {
    const rule = await this.ruleRepo.findOne({ where: { id }, relations: { place: true } });
    if (!rule) throw new NotFoundException('Không tìm thấy khoản cố định.');

    const input = this.parse({
      type: rule.type,
      amount: rule.amount,
      category: rule.category,
      note: rule.note,
      placeName: rule.place?.name,
      repeatType: rule.repeatType,
      repeatWeekdays: rule.repeatWeekdays,
      mode: rule.mode,
      notifyChatId: rule.notifyChatId,
      ...body,
      // Keys sent as undefined must not blank out the stored schedule.
      startAt: body.startAt ?? rule.nextDueAt.toISOString(),
    });
    await this.assertListenedChat(input.notifyChatId);

    const scheduleChanged =
      body.startAt !== undefined ||
      input.repeatType !== rule.repeatType ||
      input.repeatWeekdays.join() !== rule.repeatWeekdays.join();

    if (input.placeName !== rule.place?.name) {
      rule.placeId = await this.placeIdFor(input.placeName);
      rule.place = undefined;
    }
    rule.type = input.type;
    rule.amount = input.amount;
    rule.category = input.category;
    rule.note = input.note;
    rule.mode = input.mode;
    rule.notifyChatId = input.notifyChatId;
    rule.repeatType = input.repeatType;
    rule.repeatWeekdays = input.repeatWeekdays;
    if (scheduleChanged) {
      const firstDue = upcomingTime(input.startAt, input, now);
      rule.anchorAt = firstDue;
      rule.nextDueAt = firstDue;
    }
    if (body.isActive !== undefined) {
      rule.isActive = body.isActive;
      // Resuming does not bill the paused periods: they were left out on purpose.
      if (rule.isActive && rule.nextDueAt.getTime() <= now.getTime()) {
        rule.nextDueAt =
          nextOccurrence(rule.nextDueAt, rule.anchorAt, ruleRepeat(rule), now) ?? rule.nextDueAt;
      }
    }
    const saved = await this.ruleRepo.save(rule);
    return this.toRuleItem(saved, new Map());
  }

  /** Recorded transactions stay; only the rule and its periods go. */
  public async remove(id: string): Promise<boolean> {
    const result = await this.ruleRepo.delete({ id });
    return Boolean(result.affected);
  }

  /** Creates every period that came due. Called by the scan job. */
  public async processDue(now: Date = new Date()): Promise<void> {
    const due = await this.ruleRepo.find({
      select: { id: true },
      where: { isActive: true, nextDueAt: LessThanOrEqual(now) },
    });
    for (const { id } of due) {
      try {
        await this.dataSource.transaction((manager) => this.processRule(manager, id, now));
      } catch (err: unknown) {
        // One bad rule must not stop the others; it is retried on the next scan.
        this.logger.error(
          `Recurring rule ${id} failed: ${err instanceof Error ? err.message : 'unknown error'}`,
        );
      }
    }
  }

  private async processRule(manager: EntityManager, id: string, now: Date): Promise<void> {
    // skip_locked: another instance already has this rule.
    const rule = await manager.findOne(RecurringTransactionEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write', onLocked: 'skip_locked' },
    });
    if (!rule?.isActive || rule.nextDueAt.getTime() > now.getTime()) return;

    let dueAt = rule.nextDueAt;
    for (let i = 0; dueAt.getTime() <= now.getTime() && i < MAX_CATCH_UP_PERIODS; i += 1) {
      await this.createOccurrence(manager, rule, dueAt, now);
      // Walking from `dueAt`, not `now`, so a period missed while the server was down still counts:
      // unlike a reminder, this is money that really moved.
      const next = nextOccurrence(dueAt, rule.anchorAt, ruleRepeat(rule), dueAt);
      if (!next) throw new Error(`Rule has no next period after ${dueAt.toISOString()}`);
      dueAt = next;
    }
    await manager.update(RecurringTransactionEntity, { id }, { nextDueAt: dueAt });
  }

  private async createOccurrence(
    manager: EntityManager,
    rule: RecurringTransactionEntity,
    dueAt: Date,
    now: Date,
  ): Promise<void> {
    const inserted = await manager
      .createQueryBuilder()
      .insert()
      .into(RecurringOccurrenceEntity)
      .values({
        ruleId: rule.id,
        dueAt,
        amount: rule.amount,
        status: 'due',
        notifiedAt: rule.notifyChatId ? null : now,
      })
      .orIgnore()
      .returning('id')
      .execute();
    const row = (inserted.raw as Array<{ id: string }>)[0];
    if (!row || rule.mode !== 'auto' || rule.amount === null) return;

    const transaction = await manager.save(
      manager.create(FinanceTransactionEntity, {
        type: rule.type,
        amount: rule.amount,
        category: rule.category,
        note: rule.note,
        placeId: rule.placeId ?? undefined,
        occurredAt: dueAt,
        createdByUserId: rule.createdByUserId ?? undefined,
        createdByName: rule.createdByName ?? undefined,
        source: 'system',
      }),
    );
    await manager.update(
      RecurringOccurrenceEntity,
      { id: row.id },
      { status: 'recorded', transactionId: transaction.id, resolvedAt: now },
    );
  }

  /** Records a waiting period; the row lock makes a double click or a Zalo + web race harmless. */
  public async recordOccurrence(
    id: string,
    input: IRecordOccurrenceRequest,
    actor: OccurrenceActor,
    now: Date = new Date(),
  ): Promise<FinanceTransactionEntity> {
    return this.dataSource.transaction(async (manager) => {
      const occurrence = await this.lockDue(manager, id);
      const rule = await manager.findOneByOrFail(RecurringTransactionEntity, {
        id: occurrence.ruleId,
      });
      const amount = Math.round(Number(input.amount ?? occurrence.amount));
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new BadRequestException('Cần nhập số tiền của kỳ này.');
      }
      const transaction = await manager.save(
        manager.create(FinanceTransactionEntity, {
          type: rule.type,
          amount,
          category: rule.category,
          note: rule.note,
          placeId: rule.placeId ?? undefined,
          occurredAt: occurrence.dueAt,
          createdByUserId: actor.userId,
          createdByName: actor.name,
          source: actor.source,
          sourceChatId: actor.chatId,
        }),
      );
      await manager.update(
        RecurringOccurrenceEntity,
        { id },
        { status: 'recorded', amount, transactionId: transaction.id, resolvedAt: now },
      );
      return transaction;
    });
  }

  public async skipOccurrence(id: string, now: Date = new Date()): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.lockDue(manager, id);
      await manager.update(
        RecurringOccurrenceEntity,
        { id },
        { status: 'skipped', resolvedAt: now },
      );
    });
  }

  private async lockDue(manager: EntityManager, id: string): Promise<RecurringOccurrenceEntity> {
    const occurrence = await manager.findOne(RecurringOccurrenceEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!occurrence) throw new NotFoundException('Không tìm thấy kỳ này.');
    if (occurrence.status !== 'due') throw new BadRequestException('Kỳ này đã được xử lý rồi.');
    return occurrence;
  }

  /** Waiting periods matching a chat request, by the rule's name or category. */
  public async findDue(query: string): Promise<RecurringOccurrenceEntity[]> {
    const needle = query.trim().toLowerCase();
    const rows = await this.listDue();
    if (!needle) return rows;
    return rows.filter(
      (row) =>
        row.rule?.note.toLowerCase().includes(needle) ||
        row.rule?.category.toLowerCase().includes(needle),
    );
  }

  public listUnnotified(): Promise<RecurringOccurrenceEntity[]> {
    return this.occurrenceRepo.find({
      where: { notifiedAt: IsNull() },
      relations: { rule: true },
      order: { dueAt: 'ASC' },
      take: NOTIFY_BATCH,
    });
  }

  public async markNotified(id: string, now: Date = new Date()): Promise<void> {
    await this.occurrenceRepo.update({ id }, { notifiedAt: now });
  }
}

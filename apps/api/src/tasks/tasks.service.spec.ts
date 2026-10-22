import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FindOperator, type Repository } from 'typeorm';
import { TaskReminderTimeEntity } from '../database/entities/task-reminder-time.entity';
import { TaskEntity } from '../database/entities/task.entity';
import type { UserEntity } from '../database/entities/user.entity';
import { createTargetService } from '../reminders/reminder-target.fixtures.spec';
import { TasksService } from './tasks.service';

type Row = TaskEntity;
type TimeRow = TaskReminderTimeEntity;
type Where = Record<string, unknown>;

function matches(row: object, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual: unknown = Reflect.get(row, key);
    if (expected instanceof FindOperator) {
      const isNull = actual === null || actual === undefined;
      const value: unknown = expected.value;
      if (expected.type === 'isNull') return isNull;
      if (expected.type === 'not' && expected.child?.type === 'isNull') return !isNull;
      if (expected.type === 'in' && Array.isArray(value)) return value.includes(actual);
      if (expected.type === 'lessThan' && actual instanceof Date && value instanceof Date) {
        return actual.getTime() < value.getTime();
      }
      throw new Error(`Unsupported operator ${expected.type}`);
    }
    if (expected instanceof Date && actual instanceof Date) {
      return expected.getTime() === actual.getTime();
    }
    return actual === expected;
  });
}

/** In-memory stand-in for a TypeORM repository: create/save/find/findOne/update/delete. */
function createMemoryRepo<T extends { id: string }>(rows: T[], prefix: string) {
  let nextId = 1;
  const saveOne = (row: T) => {
    if (!row.id) {
      row.id = `${prefix}-0000-4000-8000-${String(nextId++).padStart(12, '0')}`;
      Reflect.set(row, 'createdAt', new Date());
      rows.push(row);
    }
    Reflect.set(row, 'updatedAt', new Date());
    return row;
  };
  return {
    create: (values: Partial<T>) => ({ ...values }) as T,
    save: (value: T | T[]) =>
      Promise.resolve(Array.isArray(value) ? value.map(saveOne) : saveOne(value)),
    find: ({ where }: { where: Where }) => Promise.resolve(rows.filter((r) => matches(r, where))),
    findOne: ({ where }: { where: Where }) =>
      Promise.resolve(rows.find((r) => matches(r, where)) ?? null),
    update: (where: Where, values: Partial<T>) => {
      const hits = rows.filter((r) => matches(r, where));
      hits.forEach((r) => Object.assign(r, values));
      return Promise.resolve({ affected: hits.length });
    },
    delete: (ids: string[]) => {
      const before = rows.length;
      rows.splice(0, rows.length, ...rows.filter((r) => !ids.includes(r.id)));
      return Promise.resolve({ affected: before - rows.length });
    },
  };
}

/** Tasks repository: the memory repo plus the `listTasks` query builder. */
function createRepo(rows: Row[]) {
  const builder = () => {
    const params: Record<string, unknown> = {};
    const qb = {
      where: (_sql: string, p?: Record<string, unknown>) => (Object.assign(params, p), qb),
      andWhere: (_sql: string, p?: Record<string, unknown>) => (Object.assign(params, p), qb),
      orderBy: () => qb,
      addOrderBy: () => qb,
      take: () => qb,
      // `listTasks` read: live rows, filtered by status (ordering is SQL, not re-checked here).
      getMany: () =>
        Promise.resolve(
          rows.filter((r) => !r.deletedAt && (!params.status || r.status === params.status)),
        ),
    };
    return qb;
  };
  const repo = { ...createMemoryRepo(rows, '00000000'), createQueryBuilder: builder };
  return repo as unknown as Repository<TaskEntity>;
}

const createService = (rows: Row[]) => new TasksService(createRepo(rows));

/**
 * Tasks with reminder times, over the shared reminder-target fixtures: g1 (members 111, 222)
 * and g3 listened, g2 not. Returns the rows so tests can look at the stored times.
 */
function createReminderService(rows: Row[] = []) {
  const times: TimeRow[] = [];
  const service = new TasksService(
    createRepo(rows),
    {
      findOne: () => Promise.resolve(null),
      find: () => Promise.resolve([]),
    } as unknown as Repository<UserEntity>,
    undefined,
    createTargetService().service,
    createMemoryRepo(times, '11111111') as unknown as Repository<TaskReminderTimeEntity>,
  );
  const timesOf = (taskId: string) =>
    times
      .filter((time) => time.taskId === taskId)
      .sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime());
  return { service, times, timesOf };
}

const inHours = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000);

const DUE = new Date('2026-10-23T23:59:59.000Z');

void test('createTask saves a trimmed, open task with its creator and source chat', async () => {
  const rows: Row[] = [];
  const row = await createService(rows).createTask(
    { title: ' Nộp báo cáo ', notes: '  ', dueAt: DUE },
    { userId: 'u1', name: ' Dat ', chatId: 'g1', source: 'zalo' },
  );
  assert.equal(rows.length, 1);
  assert.equal(row.title, 'Nộp báo cáo');
  assert.equal(row.notes, null);
  assert.equal(row.status, 'needsAction');
  assert.equal(row.completedAt, null);
  assert.equal(row.dueAt, DUE);
  assert.equal(row.createdByUserId, 'u1');
  assert.equal(row.createdByName, 'Dat');
  assert.equal(row.sourceChatId, 'g1');
  assert.equal(row.source, 'zalo');
});

void test('an empty title falls back to the untitled label', async () => {
  const row = await createService([]).createTask({ title: '   ' }, { source: 'dashboard' });
  assert.equal(row.title, 'Không có tiêu đề');
});

void test('completing keeps the first completion time; re-opening clears it', async () => {
  const service = createService([]);
  const row = await service.createTask({ title: 'Mua sữa' }, { source: 'zalo' });

  const done = await service.completeTask(row.id);
  assert.equal(done.status, 'completed');
  const completedAt = done.completedAt;
  assert.ok(completedAt);

  const edited = await service.updateTask(row.id, { notes: 'Loại không đường' });
  assert.equal(edited.completedAt, completedAt);
  assert.equal(edited.notes, 'Loại không đường');

  const reopened = await service.updateTask(row.id, { status: 'needsAction' });
  assert.equal(reopened.completedAt, null);
});

void test('updateTask clears notes and due date with empty values, keeps them when omitted', async () => {
  const service = createService([]);
  const row = await service.createTask(
    { title: 'Mua sữa', notes: 'a', dueAt: DUE },
    { source: 'zalo' },
  );

  const kept = await service.updateTask(row.id, { title: 'Mua sữa chua' });
  assert.equal(kept.notes, 'a');
  assert.equal(kept.dueAt, DUE);

  const cleared = await service.updateTask(row.id, { notes: '', dueAt: null });
  assert.equal(cleared.notes, null);
  assert.equal(cleared.dueAt, null);
});

void test('deleteTask soft-deletes; the task is then not found or listed', async () => {
  const rows: Row[] = [];
  const service = createService(rows);
  const row = await service.createTask({ title: 'Mua sữa' }, { source: 'zalo' });
  const deleted = await service.deleteTask(row.id);
  assert.ok(deleted.deletedAt);
  assert.equal(rows.length, 1);
  await assert.rejects(service.getTask(row.id), NotFoundException);
  assert.deepEqual(await service.listTasks(), []);
});

void test('getTask rejects ids that are not task row ids', async () => {
  await assert.rejects(createService([]).getTask('google-task-id'), NotFoundException);
});

void test('findPotentialDuplicateTasks matches open tasks only', async () => {
  const service = createService([]);
  await service.createTask({ title: 'Học C# (ánh xạ bằng TS)' }, { source: 'dashboard' });
  await service.createTask({ title: 'Học C#', status: 'completed' }, { source: 'dashboard' });
  const warnings = await service.findPotentialDuplicateTasks(['Học C#']);
  assert.equal(warnings.length, 1);
  assert.deepEqual(
    warnings[0].matches.map((m) => m.title),
    ['Học C# (ánh xạ bằng TS)'],
  );
});

void test('a task from Zalo reminds in the chat it was asked in, at every time', async () => {
  const { service, timesOf } = createReminderService();
  const row = await service.createTask(
    { title: 'Họp', remindTimes: [inHours(3), inHours(1)] },
    { userId: 'u1', chatId: 'g9', source: 'zalo' },
  );
  assert.equal(row.remindChatId, 'g9');
  assert.deepEqual(
    timesOf(row.id).map((t) => t.sentAt ?? null),
    [null, null],
  );
  assert.equal(row.remindAt?.getTime(), timesOf(row.id)[0].remindAt.getTime(), 'next = earliest');
});

void test("a dashboard reminder defaults to the user's private chat", async () => {
  const { service } = createReminderService();
  const row = await service.createTask(
    { title: 'Họp', remindTimes: [inHours(2)] },
    { userId: '111', source: 'dashboard' },
  );
  assert.equal(row.remindChatId, '111');
});

void test('dashboard-owner must pick a reminder chat, and only a listened one', async () => {
  const { service } = createReminderService();
  const owner = { userId: 'dashboard-owner', source: 'dashboard' } as const;
  const remindTimes = [inHours(2)];
  await assert.rejects(
    service.createTask({ title: 'Họp', remindTimes }, owner),
    BadRequestException,
  );
  await assert.rejects(
    service.createTask({ title: 'Họp', remindTimes, remindChatId: 'g2' }, owner),
    BadRequestException,
  );
  // A group needs someone to remind.
  await assert.rejects(
    service.createTask({ title: 'Họp', remindTimes, remindChatId: 'g1' }, owner),
    BadRequestException,
  );
  const row = await service.createTask(
    { title: 'Họp', remindTimes, remindChatId: 'g1', remindUserIds: ['222'] },
    owner,
  );
  assert.equal(row.remindChatId, 'g1');
});

void test('new times in the past or more than 10 times are rejected, nothing is saved', async () => {
  const rows: Row[] = [];
  const { service } = createReminderService(rows);
  const actor = { userId: '111', source: 'dashboard' } as const;
  await assert.rejects(
    service.createTask({ title: 'Họp', remindTimes: [inHours(-1)] }, actor),
    BadRequestException,
  );
  const eleven = Array.from({ length: 11 }, (_, i) => inHours(i + 1));
  await assert.rejects(
    service.createTask({ title: 'Họp', remindTimes: eleven }, actor),
    BadRequestException,
  );
  assert.equal(rows.length, 0);
});

void test('replacing the times keeps a sent time sent and only adds the new ones', async () => {
  const { service, timesOf } = createReminderService();
  const actor = { userId: '111' };
  const first = inHours(1);
  const second = inHours(2);
  const row = await service.createTask(
    { title: 'Họp', remindTimes: [first, second] },
    { ...actor, source: 'dashboard' },
  );
  const [firstTime] = timesOf(row.id);
  assert.equal(await service.markTaskReminderSent(firstTime.id), true);
  await service.refreshReminderSummary(row);
  assert.equal(row.remindAt?.getTime(), second.getTime(), 'next = the time not sent');
  assert.ok(row.remindedAt);

  const third = inHours(3);
  const edited = await service.updateTask(row.id, { remindTimes: [first, third] }, actor);
  assert.deepEqual(
    timesOf(row.id).map((t) => [t.remindAt.getTime(), !!t.sentAt]),
    [
      [first.getTime(), true],
      [third.getTime(), false],
    ],
  );
  assert.equal(edited.remindAt?.getTime(), third.getTime());
});

void test('changing the target never re-sends a sent time', async () => {
  const { service, timesOf } = createReminderService();
  const actor = { userId: '111' };
  const row = await service.createTask(
    { title: 'Họp', remindTimes: [inHours(1)] },
    { ...actor, source: 'dashboard' },
  );
  await service.markTaskReminderSent(timesOf(row.id)[0].id);
  const moved = await service.updateTask(
    row.id,
    { remindChatId: 'g1', remindUserIds: ['222'], remindMode: 'direct' },
    actor,
  );
  assert.equal(moved.remindChatId, 'g1');
  assert.deepEqual(moved.remindUsers, [{ id: '222', name: 'Trí' }]);
  assert.equal(moved.remindMode, 'direct');
  assert.ok(timesOf(row.id)[0].sentAt, 'still sent');
});

void test('other edits leave the reminder alone; an empty list removes it and its target', async () => {
  const { service, timesOf } = createReminderService();
  const actor = { userId: '111' };
  const row = await service.createTask(
    { title: 'Họp', remindTimes: [inHours(1)], remindChatId: 'g1', remindUserIds: ['222'] },
    { ...actor, source: 'dashboard' },
  );
  const renamed = await service.updateTask(row.id, { title: 'Họp nhóm' }, actor);
  assert.equal(renamed.remindChatId, 'g1');
  assert.equal(timesOf(row.id).length, 1);

  const cleared = await service.updateTask(row.id, { remindTimes: [] }, actor);
  assert.equal(timesOf(row.id).length, 0);
  assert.equal(cleared.remindAt, null);
  assert.equal(cleared.remindChatId, null);
  assert.deepEqual(cleared.remindUsers, []);
});

void test('re-opening a task skips the times that passed while it was done', async () => {
  const { service, timesOf } = createReminderService();
  const row = await service.createTask(
    { title: 'Họp', remindTimes: [inHours(1), inHours(5)] },
    { userId: '111', source: 'dashboard' },
  );
  await service.completeTask(row.id);
  // The first time passes while the task is done.
  timesOf(row.id)[0].remindAt = inHours(-1);
  const reopened = await service.updateTask(row.id, { status: 'needsAction' });
  const [passed, future] = timesOf(row.id);
  assert.ok(passed.sentAt, 'the passed time is skipped');
  assert.equal(future.sentAt, null);
  assert.equal(reopened.remindAt?.getTime(), future.remindAt.getTime());
});

void test('markTaskReminderSent only succeeds once', async () => {
  const { service, timesOf } = createReminderService();
  const row = await service.createTask(
    { title: 'Họp', remindTimes: [inHours(1)] },
    { userId: '111', source: 'dashboard' },
  );
  const [time] = timesOf(row.id);
  assert.equal(await service.markTaskReminderSent(time.id), true);
  assert.equal(await service.markTaskReminderSent(time.id), false);
});

void test('a bot task keeps the people tagged in the message', async () => {
  const { service } = createReminderService();
  const row = await service.createTask(
    { title: 'Họp', remindTimes: [inHours(2)], remindUsers: [{ id: '333', name: 'Lan' }] },
    { userId: '111', chatId: 'g1', source: 'zalo' },
  );
  assert.equal(row.remindChatId, 'g1');
  assert.deepEqual(row.remindUsers, [{ id: '333', name: 'Lan' }]);
});

void test('picking someone outside the group is rejected', async () => {
  await assert.rejects(
    createReminderService().service.createTask(
      { title: 'Họp', remindTimes: [inHours(2)], remindChatId: 'g1', remindUserIds: ['999'] },
      { userId: '111', source: 'dashboard' },
    ),
    BadRequestException,
  );
});

void test('toItems lists every time and the next one as remindAt', async () => {
  const { service, timesOf } = createReminderService();
  const row = await service.createTask(
    { title: 'Họp', remindTimes: [inHours(1), inHours(2)] },
    { userId: '111', source: 'dashboard' },
  );
  await service.markTaskReminderSent(timesOf(row.id)[0].id);
  const [item] = await service.toItems([row]);
  assert.equal(item.remindTimes?.length, 2);
  assert.ok(item.remindTimes?.[0].sentAt);
  assert.equal(item.remindAt, timesOf(row.id)[1].remindAt.toISOString());
});

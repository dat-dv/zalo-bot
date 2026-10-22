import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FindOperator, type Repository } from 'typeorm';
import { TaskEntity } from '../database/entities/task.entity';
import type { UserEntity } from '../database/entities/user.entity';
import type { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import { TasksService } from './tasks.service';

type Row = TaskEntity;
type Where = Record<string, unknown>;

function matches(row: Row, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = (row as unknown as Record<string, unknown>)[key];
    if (expected instanceof FindOperator) {
      const isNull = actual === null || actual === undefined;
      if (expected.type === 'isNull') return isNull;
      if (expected.type === 'not' && expected.child?.type === 'isNull') return !isNull;
      throw new Error(`Unsupported operator ${expected.type}`);
    }
    return actual === expected;
  });
}

/** In-memory stand-in for the TypeORM repository, covering what `TasksService` uses. */
function createRepo(rows: Row[]) {
  let nextId = 1;
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
  const repo = {
    create: (values: Partial<Row>) => ({ ...values }) as Row,
    save: (row: Row) => {
      if (!row.id) {
        row.id = `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`;
        row.createdAt = new Date();
        rows.push(row);
      }
      row.updatedAt = new Date();
      return Promise.resolve(row);
    },
    findOne: ({ where }: { where: Where }) =>
      Promise.resolve(rows.find((r) => matches(r, where)) ?? null),
    update: (where: Where, values: Partial<Row>) => {
      const hits = rows.filter((r) => matches(r, where));
      hits.forEach((r) => Object.assign(r, values));
      return Promise.resolve({ affected: hits.length });
    },
    createQueryBuilder: builder,
  };
  return repo as unknown as Repository<TaskEntity>;
}

type Thread = Pick<ZcaThreadConfigEntity, 'threadId' | 'threadName' | 'threadType' | 'isListened'>;

/** `zca_thread_configs` stand-in: `count` / `find` by exact field values. */
function createThreadRepo(threads: Thread[]) {
  const pick = (where: Partial<Thread>) =>
    threads.filter((t) =>
      Object.entries(where).every(([key, value]) => t[key as keyof Thread] === value),
    );
  const repo = {
    count: ({ where }: { where: Partial<Thread> }) => Promise.resolve(pick(where).length),
    find: ({ where }: { where: Partial<Thread> }) => Promise.resolve(pick(where)),
  };
  return repo as unknown as Repository<ZcaThreadConfigEntity>;
}

const createService = (rows: Row[]) => new TasksService(createRepo(rows));

const THREADS: Thread[] = [
  { threadId: 'g1', threadName: 'Nhà mình', threadType: 'group', isListened: true },
  { threadId: 'g2', threadName: 'Cũ', threadType: 'group', isListened: false },
];

const createReminderService = (rows: Row[] = []) =>
  new TasksService(
    createRepo(rows),
    { findOne: () => Promise.resolve(null) } as unknown as Repository<UserEntity>,
    createThreadRepo(THREADS),
  );

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

void test('a task from Zalo reminds in the chat it was asked in', async () => {
  const remindAt = inHours(2);
  const row = await createReminderService().createTask(
    { title: 'Họp', remindAt },
    { userId: 'u1', chatId: 'g9', source: 'zalo' },
  );
  assert.equal(row.remindAt, remindAt);
  assert.equal(row.remindChatId, 'g9');
  assert.equal(row.remindedAt, null);
});

void test("a dashboard reminder defaults to the user's private chat", async () => {
  const row = await createReminderService().createTask(
    { title: 'Họp', remindAt: inHours(2) },
    { userId: '111', source: 'dashboard' },
  );
  assert.equal(row.remindChatId, '111');
});

void test('dashboard-owner must pick a reminder chat, and only a listened one', async () => {
  const service = createReminderService();
  const owner = { userId: 'dashboard-owner', source: 'dashboard' } as const;
  await assert.rejects(
    service.createTask({ title: 'Họp', remindAt: inHours(2) }, owner),
    BadRequestException,
  );
  await assert.rejects(
    service.createTask({ title: 'Họp', remindAt: inHours(2), remindChatId: 'g2' }, owner),
    BadRequestException,
  );
  const row = await service.createTask(
    { title: 'Họp', remindAt: inHours(2), remindChatId: 'g1' },
    owner,
  );
  assert.equal(row.remindChatId, 'g1');
});

void test('a reminder time in the past is rejected', async () => {
  await assert.rejects(
    createReminderService().createTask(
      { title: 'Họp', remindAt: inHours(-1) },
      { userId: '111', source: 'dashboard' },
    ),
    BadRequestException,
  );
});

void test('changing the reminder re-arms it; other edits keep it sent; null clears it', async () => {
  const service = createReminderService();
  const actor = { userId: '111' };
  const row = await service.createTask(
    { title: 'Họp', remindAt: inHours(2) },
    { ...actor, source: 'dashboard' },
  );
  assert.equal(await service.markTaskReminded(row.id), true);
  assert.ok(row.remindedAt);

  const renamed = await service.updateTask(row.id, { title: 'Họp nhóm' }, actor);
  assert.ok(renamed.remindedAt, 'an unrelated edit keeps the sent mark');
  assert.equal(renamed.remindChatId, '111');

  const moved = await service.updateTask(row.id, { remindAt: inHours(3) }, actor);
  assert.equal(moved.remindedAt, null);
  assert.equal(moved.remindChatId, '111', 'keeps the chat already set');

  const regrouped = await service.updateTask(row.id, { remindChatId: 'g1' }, actor);
  assert.equal(regrouped.remindChatId, 'g1');

  const cleared = await service.updateTask(row.id, { remindAt: null }, actor);
  assert.equal(cleared.remindAt, null);
  assert.equal(cleared.remindChatId, null);
});

void test('completing a task whose reminder already passed still works', async () => {
  const rows: Row[] = [];
  const service = createReminderService(rows);
  const row = await service.createTask(
    { title: 'Họp', remindAt: inHours(1) },
    { userId: '111', source: 'dashboard' },
  );
  row.remindAt = inHours(-1);
  const done = await service.completeTask(row.id);
  assert.equal(done.status, 'completed');
});

void test('markTaskReminded only succeeds once', async () => {
  const service = createReminderService();
  const row = await service.createTask(
    { title: 'Họp', remindAt: inHours(1) },
    { userId: '111', source: 'dashboard' },
  );
  assert.equal(await service.markTaskReminded(row.id), true);
  assert.equal(await service.markTaskReminded(row.id), false);
});

void test('listReminderChannels lists listened threads, plus the private chat of Zalo users', async () => {
  const service = createReminderService();
  assert.deepEqual(await service.listReminderChannels('dashboard-owner'), [
    { id: 'g1', name: 'Nhà mình', type: 'group' },
  ]);
  assert.deepEqual(await service.listReminderChannels('111'), [
    { id: '111', name: '111', type: 'user', isSelf: true },
    { id: 'g1', name: 'Nhà mình', type: 'group' },
  ]);
});

void test('isUnlistenedGroup flags groups the admin stopped listening to', async () => {
  const service = createReminderService();
  assert.equal(await service.isUnlistenedGroup('g2'), true);
  assert.equal(await service.isUnlistenedGroup('g1'), false);
  assert.equal(await service.isUnlistenedGroup('111'), false);
});

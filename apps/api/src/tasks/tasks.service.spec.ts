import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { FindOperator, type Repository } from 'typeorm';
import { TaskEntity } from '../database/entities/task.entity';
import { TasksService } from './tasks.service';

type Row = TaskEntity;
type Where = Record<string, unknown>;

function matches(row: Row, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = (row as unknown as Record<string, unknown>)[key];
    if (expected instanceof FindOperator) {
      if (expected.type === 'isNull') return actual === null || actual === undefined;
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
    createQueryBuilder: builder,
  };
  return repo as unknown as Repository<TaskEntity>;
}

const createService = (rows: Row[]) => new TasksService(createRepo(rows));

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

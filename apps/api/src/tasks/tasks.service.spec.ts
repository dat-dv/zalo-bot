import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { FindOperator, type Repository } from 'typeorm';
import { TaskEntity } from '../database/entities/task.entity';
import type { GoogleAuthService } from '../google/google-auth.service';
import type {
  GoogleTaskBody,
  GoogleTasksService,
  RemoteGoogleTask,
} from '../google/google-tasks.service';
import { TasksService } from './tasks.service';

type Row = TaskEntity;
type Where = Record<string, unknown>;

function matches(row: Row, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = (row as unknown as Record<string, unknown>)[key];
    if (expected instanceof FindOperator) {
      if (expected.type === 'isNull') return actual === null || actual === undefined;
      if (expected.type === 'in') {
        const values: unknown = expected.value;
        return Array.isArray(values) && values.includes(actual);
      }
      throw new Error(`Unsupported operator ${expected.type}`);
    }
    return actual === expected;
  });
}

/**
 * In-memory stand-in for the TypeORM repository. Query builders only support the shapes
 * `TasksService` uses (read, update by id, insert-or-ignore, "vanished" soft delete).
 */
function createRepo(rows: Row[]) {
  let nextId = 1;
  const builder = () => {
    let op: 'update' | 'insert' = 'update';
    let setValues: Partial<Row> = {};
    let insertValues: Partial<Row> = {};
    const params: Record<string, unknown> = {};
    const qb = {
      update: () => ((op = 'update'), qb),
      insert: () => ((op = 'insert'), qb),
      into: () => qb,
      set: (values: Partial<Row>) => ((setValues = values), qb),
      values: (values: Partial<Row>) => ((insertValues = values), qb),
      orIgnore: () => qb,
      callListeners: () => qb,
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
      execute: () => {
        if (op === 'insert') {
          rows.push({
            id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            ...insertValues,
          } as Row);
        } else if (typeof params.id === 'string') {
          Object.assign(rows.find((r) => r.id === params.id) ?? {}, setValues);
        } else {
          const remoteIds = (params.remoteIds as string[] | undefined) ?? [];
          for (const r of rows) {
            if (
              r.googleAccountEmail === params.accountEmail &&
              r.googleTaskId &&
              !r.deletedAt &&
              r.syncStatus === 'synced' &&
              !remoteIds.includes(r.googleTaskId)
            ) {
              Object.assign(r, setValues);
            }
          }
        }
        return Promise.resolve({});
      },
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
    find: ({ where }: { where: Where }) => Promise.resolve(rows.filter((r) => matches(r, where))),
    createQueryBuilder: builder,
  };
  return repo as unknown as Repository<TaskEntity>;
}

interface GoogleState {
  /** userId key ('' = shared) -> account email; absent = not connected. */
  accounts: Map<string, string>;
  inserted: Array<{ body: GoogleTaskBody; userId?: string }>;
  patched: Array<{ taskId: string; body: GoogleTaskBody; userId?: string }>;
  deleted: Array<{ taskId: string; userId?: string }>;
  remote: RemoteGoogleTask[];
  failInsert?: boolean;
  deleteStatus?: number;
}

function createService(rows: Row[], state: GoogleState) {
  const account = (userId?: string) => state.accounts.get(userId ?? '') ?? state.accounts.get('');
  const auth = {
    isAuthorized: (userId?: string) => account(userId) !== undefined,
    getAccountEmail: (userId?: string) => Promise.resolve(account(userId) ?? null),
    handleAuthError: () => Promise.resolve(false),
  } as unknown as GoogleAuthService;
  const google = {
    insertTask: (body: GoogleTaskBody, userId?: string) => {
      if (state.failInsert) return Promise.reject(new Error('quota'));
      state.inserted.push({ body, userId });
      return Promise.resolve({ id: `g-${state.inserted.length}` });
    },
    patchTask: (taskId: string, body: GoogleTaskBody, _listId: string, userId?: string) => {
      state.patched.push({ taskId, body, userId });
      return Promise.resolve({ id: taskId });
    },
    deleteTask: (taskId: string, _listId: string, userId?: string) => {
      if (state.deleteStatus) {
        return Promise.reject(Object.assign(new Error('gone'), { code: state.deleteStatus }));
      }
      state.deleted.push({ taskId, userId });
      return Promise.resolve();
    },
    listAllTasks: () => Promise.resolve(state.remote),
  } as unknown as GoogleTasksService;
  return new TasksService(createRepo(rows), google, auth);
}

function googleState(overrides: Partial<GoogleState> = {}): GoogleState {
  return {
    accounts: new Map([['', 'shared@gmail.com']]),
    inserted: [],
    patched: [],
    deleted: [],
    remote: [],
    ...overrides,
  };
}

const DUE = new Date('2026-10-23T23:59:59.000Z');

void test('createTask saves the task and copies it to the connected Google account', async () => {
  const rows: Row[] = [];
  const state = googleState();
  const row = await createService(rows, state).createTask(
    { title: ' Nộp báo cáo ', dueAt: DUE },
    { userId: 'u1', chatId: 'g1', source: 'zalo' },
  );
  assert.equal(rows.length, 1);
  assert.equal(row.title, 'Nộp báo cáo');
  assert.equal(row.status, 'needsAction');
  assert.equal(row.syncStatus, 'synced');
  assert.equal(row.googleTaskId, 'g-1');
  assert.equal(row.googleTaskListId, '@default');
  assert.equal(row.googleAccountEmail, 'shared@gmail.com');
  assert.equal(row.sourceChatId, 'g1');
  assert.equal(state.inserted[0].body.due, DUE.toISOString());
});

void test('createTask keeps the task app-only when no Google account is connected', async () => {
  const rows: Row[] = [];
  const state = googleState({ accounts: new Map() });
  const row = await createService(rows, state).createTask(
    { title: 'Mua sữa' },
    { userId: 'u1', source: 'dashboard' },
  );
  assert.equal(row.syncStatus, 'local');
  assert.equal(row.googleTaskId, undefined);
  assert.equal(state.inserted.length, 0);
});

void test('createTask still saves the task when Google rejects the copy', async () => {
  const rows: Row[] = [];
  const row = await createService(rows, googleState({ failInsert: true })).createTask(
    { title: 'Mua sữa' },
    { userId: 'u1', source: 'dashboard' },
  );
  assert.equal(rows.length, 1);
  assert.equal(row.syncStatus, 'failed');
});

void test('completing and re-opening a task updates the DB and its Google copy', async () => {
  const rows: Row[] = [];
  const state = googleState();
  const service = createService(rows, state);
  const row = await service.createTask({ title: 'Mua sữa' }, { userId: 'u1', source: 'zalo' });

  const done = await service.completeTask(row.id, 'u1');
  assert.equal(done.status, 'completed');
  assert.ok(done.completedAt);
  assert.equal(state.patched[0].body.status, 'completed');

  const reopened = await service.updateTask(row.id, { status: 'needsAction' }, 'u1');
  assert.equal(reopened.completedAt, null);
  assert.equal(state.patched[1].body.completed, null);
});

void test('updateTask re-homes a copy that sits in a Google account the system lost', async () => {
  const rows: Row[] = [];
  const state = googleState();
  const service = createService(rows, state);
  const row = await service.createTask({ title: 'Mua sữa' }, { userId: 'u1', source: 'zalo' });

  // The admin switches the shared Google account: the old copy is unreachable.
  state.accounts.set('', 'new@gmail.com');
  const moved = await service.updateTask(row.id, { notes: 'Loại không đường' }, 'u1');
  assert.equal(moved.notes, 'Loại không đường');
  assert.equal(moved.googleTaskId, 'g-2');
  assert.equal(moved.googleAccountEmail, 'new@gmail.com');
  assert.equal(moved.syncStatus, 'synced');
  assert.equal(state.patched.length, 0);
});

void test('deleteTask soft-deletes and tolerates a copy already gone from Google', async () => {
  const rows: Row[] = [];
  const state = googleState();
  const service = createService(rows, state);
  const row = await service.createTask({ title: 'Mua sữa' }, { userId: 'u1', source: 'zalo' });
  state.deleteStatus = 404;
  const deleted = await service.deleteTask(row.id, 'u1');
  assert.ok(deleted.deletedAt);
  await assert.rejects(service.getTask(row.id), NotFoundException);
});

void test('getTask also finds a task by its Google id (bot actions queued before the move)', async () => {
  const rows: Row[] = [];
  const service = createService(rows, googleState());
  const row = await service.createTask({ title: 'Mua sữa' }, { userId: 'u1', source: 'zalo' });
  assert.equal((await service.getTask('g-1')).id, row.id);
});

void test('listTasks imports Google tasks once and soft-deletes ones removed in Google', async () => {
  const rows: Row[] = [];
  const state = googleState({
    remote: [
      { listId: 'L1', task: { id: 'r1', title: 'Gọi điện cho mẹ', status: 'needsAction' } },
      {
        listId: 'L2',
        task: {
          id: 'r2',
          title: 'Đóng tiền điện',
          status: 'completed',
          completed: '2026-10-20T03:00:00.000Z',
          due: '2026-10-20T00:00:00.000Z',
        },
      },
      { listId: 'L1', task: { id: 'r3', title: 'Đã xoá', deleted: true } },
    ],
  });
  const listed = await createService(rows, state).listTasks({ importForUserId: 'u1' });

  assert.deepEqual(listed.map((r) => r.title).sort(), ['Gọi điện cho mẹ', 'Đóng tiền điện']);
  const paid = rows.find((r) => r.googleTaskId === 'r2');
  assert.equal(paid?.source, 'google');
  assert.equal(paid?.status, 'completed');
  assert.equal(paid?.googleTaskListId, 'L2');
  assert.equal(paid?.googleAccountEmail, 'shared@gmail.com');

  // Deleted in Google, then imported again after the throttle window (new service instance).
  state.remote = state.remote.filter((item) => item.task.id !== 'r1');
  const after = await createService(rows, state).listTasks({ importForUserId: 'u1' });
  assert.deepEqual(
    after.map((r) => r.title),
    ['Đóng tiền điện'],
  );
  assert.equal(rows.length, 2);
});

void test('an import never overwrites a local change that has not reached Google yet', async () => {
  const rows: Row[] = [];
  const state = googleState();
  const service = createService(rows, state);
  const row = await service.createTask({ title: 'Mua sữa' }, { userId: 'u1', source: 'zalo' });
  row.title = 'Mua sữa chua';
  row.syncStatus = 'failed';

  state.remote = [{ listId: '@default', task: { id: 'g-1', title: 'Mua sữa' } }];
  await createService(rows, state).listTasks({ importForUserId: 'u1' });
  assert.equal(rows[0].title, 'Mua sữa chua');
  assert.equal(rows[0].deletedAt ?? null, null);
});

void test('findPotentialDuplicateTasks matches open tasks only', async () => {
  const rows: Row[] = [];
  const service = createService(rows, googleState({ accounts: new Map() }));
  await service.createTask({ title: 'Học C# (ánh xạ bằng TS)' }, { source: 'dashboard' });
  await service.createTask({ title: 'Học C#', status: 'completed' }, { source: 'dashboard' });
  const warnings = await service.findPotentialDuplicateTasks(['Học C#']);
  assert.equal(warnings.length, 1);
  assert.deepEqual(
    warnings[0].matches.map((m) => m.title),
    ['Học C# (ánh xạ bằng TS)'],
  );
});

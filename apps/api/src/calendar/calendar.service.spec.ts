import assert from 'node:assert/strict';
import test from 'node:test';
import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { calendar_v3 } from 'googleapis';
import { FindOperator, type Repository } from 'typeorm';
import { CalendarEventEntity } from '../database/entities/calendar-event.entity';
import type { GoogleAuthService } from '../google/google-auth.service';
import type { GoogleCalendarService } from '../google/google-calendar.service';
import { CalendarService } from './calendar.service';

type Row = CalendarEventEntity;
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
 * `CalendarService` uses (read, update by id, insert-or-ignore, "vanished" soft delete).
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
      take: () => qb,
      // `listEvents` read: live rows by start time (range filters are SQL, not re-checked here).
      getMany: () =>
        Promise.resolve(
          rows
            .filter((r) => !r.deletedAt)
            .sort((a, b) => a.startAt.getTime() - b.startAt.getTime()),
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
          const timeMin = params.timeMin as Date;
          const timeMax = params.timeMax as Date;
          for (const r of rows) {
            if (
              r.googleAccountEmail === params.accountEmail &&
              r.googleEventId &&
              !r.deletedAt &&
              r.startAt >= timeMin &&
              r.startAt < timeMax &&
              !remoteIds.includes(r.googleEventId)
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
  return repo as unknown as Repository<CalendarEventEntity>;
}

interface GoogleState {
  /** userId key ('' = shared) -> account email; absent = not connected. */
  accounts: Map<string, string>;
  inserted: Array<{ body: calendar_v3.Schema$Event; userId?: string }>;
  patched: Array<{ eventId: string; userId?: string }>;
  deleted: Array<{ eventId: string; userId?: string }>;
  remote: calendar_v3.Schema$Event[];
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
    insertEvent: (body: calendar_v3.Schema$Event, userId?: string) => {
      if (state.failInsert) return Promise.reject(new Error('quota'));
      state.inserted.push({ body, userId });
      return Promise.resolve({ id: `g-${state.inserted.length}` });
    },
    patchEvent: (eventId: string, _body: calendar_v3.Schema$Event, userId?: string) => {
      state.patched.push({ eventId, userId });
      return Promise.resolve({ id: eventId });
    },
    deleteEvent: (eventId: string, userId?: string) => {
      if (state.deleteStatus) {
        return Promise.reject(Object.assign(new Error('gone'), { code: state.deleteStatus }));
      }
      state.deleted.push({ eventId, userId });
      return Promise.resolve(true);
    },
    listEventsInRange: () => Promise.resolve(state.remote),
  } as unknown as GoogleCalendarService;
  const config = { get: () => 'Asia/Ho_Chi_Minh' } as unknown as ConfigService;
  return new CalendarService(createRepo(rows), google, auth, config);
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

const START = new Date('2026-10-23T02:00:00.000Z');
const END = new Date('2026-10-23T03:00:00.000Z');

void test('createEvent saves the event and copies it to the connected Google account', async () => {
  const rows: Row[] = [];
  const state = googleState();
  const row = await createService(rows, state).createEvent(
    { title: ' Họp ', startAt: START, endAt: END },
    { userId: 'u1', chatId: 'g1', source: 'zalo' },
  );
  assert.equal(rows.length, 1);
  assert.equal(row.title, 'Họp');
  assert.equal(row.syncStatus, 'synced');
  assert.equal(row.googleEventId, 'g-1');
  assert.equal(row.googleAccountEmail, 'shared@gmail.com');
  assert.equal(row.sourceChatId, 'g1');
  assert.deepEqual(row.reminderMinutes, [60, 30, 10, 0]);
});

void test('createEvent keeps the event app-only when no Google account is connected', async () => {
  const rows: Row[] = [];
  const state = googleState({ accounts: new Map() });
  const row = await createService(rows, state).createEvent(
    { title: 'Họp', startAt: START, endAt: END },
    { userId: 'u1', source: 'dashboard' },
  );
  assert.equal(row.syncStatus, 'local');
  assert.equal(row.googleEventId, undefined);
  assert.equal(state.inserted.length, 0);
});

void test('createEvent still saves the event when Google rejects the copy', async () => {
  const rows: Row[] = [];
  const row = await createService(rows, googleState({ failInsert: true })).createEvent(
    { title: 'Họp', startAt: START, endAt: END },
    { userId: 'u1', source: 'dashboard' },
  );
  assert.equal(rows.length, 1);
  assert.equal(row.syncStatus, 'failed');
});

void test('updateEvent patches a copy in a connected account and re-homes one in a lost account', async () => {
  const rows: Row[] = [];
  const state = googleState();
  const service = createService(rows, state);
  const row = await service.createEvent(
    { title: 'Họp', startAt: START, endAt: END },
    { userId: 'u1', source: 'dashboard' },
  );

  await service.updateEvent(row.id, { title: 'Họp lại' }, 'u1');
  assert.deepEqual(state.patched, [{ eventId: 'g-1', userId: 'u1' }]);

  // The admin switches the shared Google account: the old copy is unreachable.
  state.accounts.set('', 'new@gmail.com');
  const moved = await service.updateEvent(row.id, { location: 'Quán cà phê' }, 'u1');
  assert.equal(moved.title, 'Họp lại');
  assert.equal(moved.location, 'Quán cà phê');
  assert.equal(moved.googleEventId, 'g-2');
  assert.equal(moved.googleAccountEmail, 'new@gmail.com');
  assert.equal(moved.syncStatus, 'synced');
});

void test('deleteEvent soft-deletes and tolerates a copy already gone from Google', async () => {
  const rows: Row[] = [];
  const state = googleState();
  const service = createService(rows, state);
  const row = await service.createEvent(
    { title: 'Họp', startAt: START, endAt: END },
    { userId: 'u1', source: 'dashboard' },
  );
  state.deleteStatus = 410;
  const deleted = await service.deleteEvent(row.id, 'u1');
  assert.ok(deleted.deletedAt);
  await assert.rejects(service.getEvent(row.id), NotFoundException);
});

void test('getEvent also finds an event by its Google id (bot actions queued before the move)', async () => {
  const rows: Row[] = [];
  const service = createService(rows, googleState());
  const row = await service.createEvent(
    { title: 'Họp', startAt: START, endAt: END },
    { userId: 'u1', source: 'zalo' },
  );
  assert.equal((await service.getEvent('g-1')).id, row.id);
});

void test('listEvents imports Google events once and soft-deletes ones removed in Google', async () => {
  const rows: Row[] = [];
  const state = googleState({
    remote: [
      {
        id: 'r1',
        summary: 'Sinh nhật',
        start: { date: '2026-10-25' },
        end: { date: '2026-10-26' },
      },
      {
        id: 'r2',
        summary: 'Khám răng',
        start: { dateTime: '2026-10-24T08:00:00+07:00' },
        end: { dateTime: '2026-10-24T09:00:00+07:00' },
      },
    ],
  });
  const service = createService(rows, state);
  const range = {
    timeMin: new Date('2026-10-01T00:00:00.000Z'),
    timeMax: new Date('2026-11-01T00:00:00.000Z'),
  };
  const listed = await service.listEvents({ ...range, importForUserId: 'u1' });

  assert.deepEqual(
    listed.map((r) => r.title),
    ['Khám răng', 'Sinh nhật'],
  );
  const birthday = rows.find((r) => r.googleEventId === 'r1');
  assert.equal(birthday?.allDay, true);
  assert.equal(birthday?.source, 'google');
  assert.equal(birthday?.googleAccountEmail, 'shared@gmail.com');

  // Deleted in Google, then imported again after the throttle window (new service instance).
  state.remote = state.remote.filter((event) => event.id !== 'r2');
  const after = await createService(rows, state).listEvents({ ...range, importForUserId: 'u1' });
  assert.deepEqual(
    after.map((r) => r.title),
    ['Sinh nhật'],
  );
  assert.equal(rows.length, 2);
});

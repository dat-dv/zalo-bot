import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { FindOperator, type Repository } from 'typeorm';
import type { ReminderTimeEntity } from '../database/entities/reminder-time.entity';
import type { ReminderEntity } from '../database/entities/reminder.entity';
import { createTargetService } from './reminder-target.fixtures.spec';
import { type DueReminderTime, RemindersService } from './reminders.service';

type Where = Record<string, unknown>;

function matches(row: object, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual: unknown = Reflect.get(row, key);
    if (expected instanceof FindOperator) {
      const value: unknown = expected.value;
      if (expected.type === 'isNull') return actual === null || actual === undefined;
      if (expected.type === 'in' && Array.isArray(value)) return value.includes(actual);
      throw new Error(`Unsupported operator ${expected.type}`);
    }
    if (expected instanceof Date && actual instanceof Date) {
      return expected.getTime() === actual.getTime();
    }
    return actual === expected;
  });
}

/** In-memory repository: create/save/find/findOne/update/delete. */
function memoryRepo<T extends { id: string }>(rows: T[], prefix: string) {
  let nextId = 1;
  const saveOne = (row: T) => {
    if (!row.id) {
      row.id = `${prefix}-${nextId++}`;
      rows.push(row);
    }
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
      rows.splice(0, rows.length, ...rows.filter((r) => !ids.includes(r.id)));
      return Promise.resolve({ affected: ids.length });
    },
  };
}

function setup() {
  const reminders: ReminderEntity[] = [];
  const times: ReminderTimeEntity[] = [];
  const service = new RemindersService(
    memoryRepo(reminders, 'r') as unknown as Repository<ReminderEntity>,
    createTargetService().service,
    memoryRepo(times, 't') as unknown as Repository<ReminderTimeEntity>,
  );
  const timesOf = (id: string) =>
    times
      .filter((time) => time.reminderId === id)
      .sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime());
  const dueTime = (reminder: ReminderEntity, time: ReminderTimeEntity): DueReminderTime =>
    Object.assign(time, { reminder });
  /** Claims a time as the scheduler does, right when it is due. */
  const claim = (reminder: ReminderEntity, time: ReminderTimeEntity) =>
    service.claimReminderTime(dueTime(reminder, time), new Date(time.remindAt.getTime() + 1000));
  return { service, reminders, times, timesOf, dueTime, claim };
}

const inHours = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000);

void test('a reminder can have several times; remindAt is the earliest', async () => {
  const { service, timesOf } = setup();
  const reminder = await service.createReminder({
    userId: '111',
    title: 'Uống thuốc',
    remindTimes: [inHours(12), inHours(1)],
  });
  assert.equal(timesOf(reminder.id).length, 2);
  assert.equal(reminder.remindAt.getTime(), timesOf(reminder.id)[0].remindAt.getTime());
  assert.equal(reminder.chatId, '111', 'the private chat by default');
});

void test('a one-off reminder completes once every time went out', async () => {
  const { service, timesOf, claim } = setup();
  const reminder = await service.createReminder({
    userId: '111',
    title: 'Họp',
    remindTimes: [inHours(1), inHours(2)],
  });
  const [first, second] = timesOf(reminder.id);
  assert.ok(await claim(reminder, first));
  assert.equal(await claim(reminder, first), null, 'only once');
  await service.refreshReminderSummary(reminder);
  assert.equal(reminder.isTriggered, false);
  assert.equal(reminder.remindAt.getTime(), second.remindAt.getTime());

  await claim(reminder, second);
  await service.refreshReminderSummary(reminder);
  assert.equal(reminder.isTriggered, true);
  assert.equal(reminder.status, 'completed');
});

void test('a daily reminder moves each of its times to the next day', async () => {
  const { service, timesOf, dueTime } = setup();
  const reminder = await service.createReminder({
    userId: '111',
    title: 'Uống thuốc',
    remindTimes: [inHours(1), inHours(13)],
    repeatType: 'daily',
  });
  const [morning] = timesOf(reminder.id);
  const before = morning.remindAt.getTime();
  assert.ok(await service.claimReminderTime(dueTime(reminder, morning), new Date(before)));
  assert.equal(morning.sentAt, null, 'a repeating time is never marked sent');
  assert.equal(morning.remindAt.getTime(), before + 24 * 60 * 60 * 1000);
  await service.refreshReminderSummary(reminder);
  assert.equal(reminder.isTriggered, false);
});

void test('editing the times keeps the ones still listed and needs at least one', async () => {
  const { service, timesOf, claim } = setup();
  const first = inHours(1);
  const reminder = await service.createReminder({
    userId: '111',
    title: 'Họp',
    remindTimes: [first, inHours(2)],
  });
  await claim(reminder, timesOf(reminder.id)[0]);
  const third = inHours(3);
  await service.updateReminder('111', reminder.id, { remindTimes: [first, third] });
  assert.deepEqual(
    timesOf(reminder.id).map((t) => [t.remindAt.getTime(), !!t.sentAt]),
    [
      [first.getTime(), true],
      [third.getTime(), false],
    ],
  );
  await assert.rejects(
    service.updateReminder('111', reminder.id, { remindTimes: [] }),
    BadRequestException,
  );
});

void test('changing the target does not re-send a sent time', async () => {
  const { service, timesOf, claim } = setup();
  const reminder = await service.createReminder({
    userId: '111',
    title: 'Họp',
    remindTimes: [inHours(1)],
  });
  await claim(reminder, timesOf(reminder.id)[0]);
  await service.refreshReminderSummary(reminder);
  const moved = await service.updateReminder('111', reminder.id, {
    chatId: 'g1',
    remindUserIds: ['222'],
  });
  assert.equal(moved?.chatId, 'g1');
  assert.equal(moved?.isTriggered, true, 'still done');
});

void test('a past time from chat is accepted and goes out on the next tick', async () => {
  const { service, timesOf } = setup();
  const reminder = await service.createReminder({
    userId: '111',
    title: 'Tắt bếp',
    remindAt: inHours(-0.5),
  });
  assert.equal(timesOf(reminder.id).length, 1);
});

void test('a legacy official-bot user must pick a chat for a dashboard reminder', async () => {
  const { service } = setup();
  const legacy = '573462d8909179cf2080';
  await assert.rejects(
    service.createReminder({ userId: legacy, title: 'Uống nước', remindTimes: [inHours(1)] }),
    BadRequestException,
  );
  const saved = await service.createReminder({
    userId: legacy,
    title: 'Uống nước',
    remindTimes: [inHours(1)],
    chatId: 'g1',
    remindUserIds: ['222'],
  });
  assert.equal(saved.chatId, 'g1');
});

void test('the done list holds only finished reminders of the user, kept after they finish', async () => {
  const { service } = setup();
  const upcoming = await service.createReminder({
    userId: '111',
    title: 'Họp',
    remindTimes: [inHours(1)],
  });
  const done = await service.createReminder({
    userId: '111',
    title: 'Uống thuốc',
    remindTimes: [inHours(2)],
  });
  const otherUser = await service.createReminder({
    userId: '222',
    title: 'Đi chợ',
    remindTimes: [inHours(3)],
  });
  await service.markCompleted(done.id, '111');
  await service.markCompleted(otherUser.id, '222');

  const ids = async (status: 'upcoming' | 'done') =>
    (await service.getUserReminders('111', status)).map((row) => row.id);
  assert.deepEqual(await ids('done'), [done.id]);
  assert.deepEqual(await ids('upcoming'), [upcoming.id]);
});

void test('the done list is latest first and capped', async () => {
  let options: unknown;
  const repo = {
    find: (value: unknown) => {
      options = value;
      return Promise.resolve([]);
    },
  };
  const service = new RemindersService(
    repo as unknown as Repository<ReminderEntity>,
    createTargetService().service,
    memoryRepo([], 't') as unknown as Repository<ReminderTimeEntity>,
  );
  await service.getUserReminders(111, 'done');
  assert.deepEqual(options, {
    where: { userId: '111', isTriggered: true },
    order: { completedAt: { direction: 'DESC', nulls: 'LAST' }, remindAt: 'DESC' },
    take: 200,
  });
});

void test('an older group reminder without people still saves edits that keep its target', async () => {
  const { service } = setup();
  const reminder = await service.createReminder({
    userId: '111',
    title: 'Họp',
    remindTimes: [inHours(1)],
    chatId: 'g1',
    remindUserIds: ['222'],
  });
  // Saved before people were required in a group.
  reminder.remindUsers = [];
  const renamed = await service.updateReminder('111', reminder.id, { title: 'Họp tuần' });
  assert.equal(renamed?.title, 'Họp tuần');
  await assert.rejects(
    service.updateReminder('111', reminder.id, { remindMode: 'direct' }),
    BadRequestException,
  );
});

void test('a one-off reminder with reminders again is done only after the last one', async () => {
  const { service, timesOf, dueTime } = setup();
  const at = inHours(1);
  const reminder = await service.createReminder({
    userId: '111',
    title: 'Uống thuốc',
    remindTimes: [at],
    nagEveryMinutes: 10,
    nagCount: 1,
  });
  const [time] = timesOf(reminder.id);
  const sentAt = new Date(at.getTime() + 1000);
  assert.deepEqual(await service.claimReminderTime(dueTime(reminder, time), sentAt), { at });
  await service.refreshReminderSummary(reminder);
  assert.equal(reminder.isTriggered, false, 'a reminder again is still to come');
  const nagAt = time.nagAt;
  assert.ok(nagAt);
  const nag = await service.claimReminderTime(dueTime(reminder, time), nagAt);
  assert.deepEqual(nag, { at: nagAt, nag: { index: 1, total: 1 } });
  await service.refreshReminderSummary(reminder);
  assert.equal(reminder.isTriggered, true);
});

void test('marking a reminder done stops its reminders again', async () => {
  const { service, timesOf, claim } = setup();
  const reminder = await service.createReminder({
    userId: '111',
    title: 'Uống thuốc',
    remindTimes: [{ at: inHours(1), repeat: { repeatType: 'weekly', repeatWeekdays: [3, 1] } }],
    nagEveryMinutes: 30,
    nagCount: 3,
  });
  assert.deepEqual(timesOf(reminder.id)[0].repeatWeekdays, [1, 3]);
  assert.equal(reminder.repeatType, 'weekly', 'legacy column: the earliest time');
  await claim(reminder, timesOf(reminder.id)[0]);
  assert.ok(timesOf(reminder.id)[0].nagAt);
  await service.markCompleted(reminder.id, '111');
  assert.equal(timesOf(reminder.id)[0].nagAt, null);
});

void test('reminding again that would overlap the next repeat is rejected', async () => {
  const { service } = setup();
  await assert.rejects(
    service.createReminder({
      userId: '111',
      title: 'Họp',
      remindTimes: [inHours(1)],
      repeatType: 'daily',
      nagEveryMinutes: 600,
      nagCount: 3,
    }),
    BadRequestException,
  );
});

void test('each time repeats on its own: a daily time and a one-off time', async () => {
  const { service, timesOf, claim } = setup();
  const morning = inHours(1);
  const once = inHours(2);
  const reminder = await service.createReminder({
    userId: '111',
    title: 'Uống thuốc',
    remindTimes: [{ at: morning, repeat: { repeatType: 'daily', repeatWeekdays: [] } }, once],
  });
  const [daily, oneOff] = timesOf(reminder.id);
  assert.equal(daily.repeatType, 'daily');
  assert.equal(oneOff.repeatType, 'none');
  await claim(reminder, daily);
  await claim(reminder, oneOff);
  assert.equal(daily.sentAt, null, 'the daily time moved on');
  assert.ok(oneOff.sentAt, 'the one-off time went out');
  await service.refreshReminderSummary(reminder);
  assert.equal(reminder.isTriggered, false, 'a repeating time never finishes the reminder');
});

void test('older clients still set one repeat for the whole reminder', async () => {
  const { service, timesOf } = setup();
  const reminder = await service.createReminder({
    userId: '111',
    title: 'Họp',
    remindTimes: [inHours(1), inHours(2)],
    repeatType: 'weekly',
  });
  assert.deepEqual(
    timesOf(reminder.id).map((time) => time.repeatType),
    ['weekly', 'weekly'],
  );
  await service.updateReminder('111', reminder.id, { repeatType: 'none' });
  assert.deepEqual(
    timesOf(reminder.id).map((time) => time.repeatType),
    ['none', 'none'],
  );
});

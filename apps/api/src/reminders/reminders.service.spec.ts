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
  return { service, reminders, times, timesOf, dueTime };
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
  const { service, timesOf, dueTime } = setup();
  const reminder = await service.createReminder({
    userId: '111',
    title: 'Họp',
    remindTimes: [inHours(1), inHours(2)],
  });
  const [first, second] = timesOf(reminder.id);
  assert.equal(await service.claimReminderTime(dueTime(reminder, first)), true);
  assert.equal(await service.claimReminderTime(dueTime(reminder, first)), false, 'only once');
  await service.refreshReminderSummary(reminder);
  assert.equal(reminder.isTriggered, false);
  assert.equal(reminder.remindAt.getTime(), second.remindAt.getTime());

  await service.claimReminderTime(dueTime(reminder, second));
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
  assert.equal(await service.claimReminderTime(dueTime(reminder, morning), new Date(before)), true);
  assert.equal(morning.sentAt, null, 'a repeating time is never marked sent');
  assert.equal(morning.remindAt.getTime(), before + 24 * 60 * 60 * 1000);
  await service.refreshReminderSummary(reminder);
  assert.equal(reminder.isTriggered, false);
});

void test('editing the times keeps the ones still listed and needs at least one', async () => {
  const { service, timesOf, dueTime } = setup();
  const first = inHours(1);
  const reminder = await service.createReminder({
    userId: '111',
    title: 'Họp',
    remindTimes: [first, inHours(2)],
  });
  await service.claimReminderTime(dueTime(reminder, timesOf(reminder.id)[0]));
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
  const { service, timesOf, dueTime } = setup();
  const reminder = await service.createReminder({
    userId: '111',
    title: 'Họp',
    remindTimes: [inHours(1)],
  });
  await service.claimReminderTime(dueTime(reminder, timesOf(reminder.id)[0]));
  await service.refreshReminderSummary(reminder);
  const moved = await service.updateReminder('111', reminder.id, { chatId: 'g1' });
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
  });
  assert.equal(saved.chatId, 'g1');
});

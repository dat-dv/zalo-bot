import assert from 'node:assert/strict';
import test from 'node:test';
import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { REMINDER_TIME_LIMITS } from '@zalobot/contracts';
import { AppValidationPipe } from '../../common/pipes/app-validation.pipe';
import { parseRemindTimesBody } from '../../reminders/reminder-rule.body';
import { CreateTaskDto, UpdateTaskDto } from './task.dto';

// `nest build` (tsc, emitDecoratorMetadata) records `remindTimes: unknown[]` as `design:type`
// Array, which drives the pipe's implicit conversion; tsx (esbuild) emits none. Set it as tsc does
// so these tests run the DTOs the way production does.
for (const dto of [CreateTaskDto, UpdateTaskDto]) {
  Reflect.defineMetadata('design:type', Array, dto.prototype, 'remindTimes');
}

// The dashboard sends each time as an object; the global pipe must hand them to the controller as sent.
const MIXED_TIMES = [
  { remindAt: '2027-01-05T01:00:00.000Z', repeatType: 'weekly', repeatWeekdays: [2, 6] },
  '2027-01-06T02:00:00.000Z',
];

async function viaPipe<T extends object>(metatype: new () => T, body: object): Promise<T> {
  const result: unknown = await new AppValidationPipe().transform(body, { type: 'body', metatype });
  assert.ok(result instanceof metatype);
  return result;
}

void test('CreateTaskDto keeps object remindTimes through AppValidationPipe', async () => {
  const dto = await viaPipe(CreateTaskDto, { title: 'Họp', remindTimes: MIXED_TIMES });

  assert.deepEqual(dto.remindTimes, MIXED_TIMES);
  assert.deepEqual(parseRemindTimesBody(dto.remindTimes, dto.remindAt), [
    {
      at: new Date('2027-01-05T01:00:00.000Z'),
      repeat: { repeatType: 'weekly', repeatWeekdays: [2, 6] },
    },
    { at: new Date('2027-01-06T02:00:00.000Z') },
  ]);
});

void test('UpdateTaskDto keeps object remindTimes, and [] still clears them', async () => {
  const dto = await viaPipe(UpdateTaskDto, { remindTimes: MIXED_TIMES });
  assert.deepEqual(dto.remindTimes, MIXED_TIMES);
  assert.equal(parseRemindTimesBody(dto.remindTimes, dto.remindAt)?.length, 2);

  const cleared = await viaPipe(UpdateTaskDto, { remindTimes: [] });
  assert.deepEqual(cleared.remindTimes, []);
});

void test('task DTOs leave a missing remindTimes undefined', async () => {
  const created = await viaPipe(CreateTaskDto, { title: 'Họp' });
  assert.equal(created.remindTimes, undefined);

  // A PATCH without remindTimes must not read as "replace the times".
  const updated = await viaPipe(UpdateTaskDto, { title: 'Họp' });
  assert.equal(updated.remindTimes, undefined);
  assert.equal(parseRemindTimesBody(updated.remindTimes, updated.remindAt), undefined);
});

void test('task DTOs reject more remindTimes than allowed', async () => {
  const tooMany = Array.from(
    { length: REMINDER_TIME_LIMITS.MAX_TIMES + 1 },
    (_, index) => `2027-01-${String(index + 1).padStart(2, '0')}T01:00:00.000Z`,
  );
  await assert.rejects(
    viaPipe(CreateTaskDto, { title: 'Họp', remindTimes: tooMany }),
    BadRequestException,
  );
  await assert.rejects(viaPipe(UpdateTaskDto, { remindTimes: tooMany }), BadRequestException);
});

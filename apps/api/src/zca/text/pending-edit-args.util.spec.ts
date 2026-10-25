import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeEditedToolArgs, pendingToolArgs } from './pending-edit-args.util';
import { requestedTimesFromArgs } from './reminder-target-args.util';

const FEB = '2027-02-14T02:00:00.000Z';
const MAR = '2027-03-08T02:00:00.000Z';
const OCT = '2027-10-20T02:00:00.000Z';
const MONTHLY = { repeatType: 'monthly', repeatWeekdays: [] as number[] };

/** The [446] card: three reminder times, the first repeating monthly. */
function taskPayload(at: (iso: string) => string | Date): Record<string, unknown> {
  return {
    title: 'Đạt mua hoa tươi tặng Hằng',
    remindAt: at(FEB),
    remindTimes: [{ at: at(FEB), repeat: MONTHLY }, { at: at(MAR) }, { at: at(OCT) }],
    remindUsers: [{ id: 'hang', name: 'Diệu Hằng' }],
    remindMode: 'mention',
  };
}

void test('a task card round-trips its reminder times through its tool args', () => {
  for (const at of [(iso: string) => iso, (iso: string) => new Date(iso)]) {
    const args = pendingToolArgs('CREATE_TASK', taskPayload(at));
    assert.ok(args);
    assert.deepEqual(requestedTimesFromArgs(args), [
      { at: FEB, repeat: MONTHLY },
      { at: MAR },
      { at: OCT },
    ]);
  }
});

void test('task tool args keep the card fields but leave the people to the tags', () => {
  assert.deepEqual(
    pendingToolArgs(
      'CREATE_TASK',
      taskPayload((iso) => iso),
    ),
    {
      title: 'Đạt mua hoa tươi tặng Hằng',
      remindTimes: [MAR, OCT],
      repeatingTimes: [{ at: FEB, repeatType: 'monthly' }],
      remindMode: 'mention',
    },
  );
});

void test('reminder tool args say a group reminder was asked for in the group', () => {
  const args = pendingToolArgs('SET_REMINDER', {
    userId: 'u1',
    title: 'Họp',
    remindAt: FEB,
    remindTimes: [{ at: FEB, repeat: { repeatType: 'weekly', repeatWeekdays: [1, 3] } }],
    nagEveryMinutes: 15,
    nagCount: 3,
    chatId: 'g1',
  });
  assert.deepEqual(args, {
    title: 'Họp',
    repeatingTimes: [{ at: FEB, repeatType: 'weekly', repeatWeekdays: [1, 3] }],
    nagEveryMinutes: 15,
    nagCount: 3,
    remindInGroup: true,
  });
});

void test('cards without an args mapping keep the full re-issue', () => {
  assert.equal(pendingToolArgs('RECORD_TRANSACTION', { amount: 45000 }), undefined);
});

void test('an edit keeps what it leaves out, including the other reminder times', () => {
  const previous = { title: 'Mua hoa', remindTimes: [MAR, OCT], notes: 'hoa hồng' };
  assert.deepEqual(mergeEditedToolArgs(previous, {}), previous);
  assert.deepEqual(mergeEditedToolArgs(previous, { notes: 'hoa ly', title: null }), {
    title: 'Mua hoa',
    remindTimes: [MAR, OCT],
    notes: 'hoa ly',
  });
});

void test('an edit that sends any reminder time replaces the whole time group', () => {
  const previous = {
    title: 'Mua hoa',
    remindTimes: [MAR, OCT],
    repeatingTimes: [{ at: FEB, repeatType: 'monthly' }],
  };
  assert.deepEqual(mergeEditedToolArgs(previous, { remindAt: FEB }), {
    title: 'Mua hoa',
    remindAt: FEB,
  });
  assert.deepEqual(mergeEditedToolArgs(previous, { remindTimes: [] }), {
    title: 'Mua hoa',
    remindTimes: [],
  });
});

void test('"remind again" changes as a pair', () => {
  assert.deepEqual(
    mergeEditedToolArgs({ nagEveryMinutes: 15, nagCount: 3 }, { nagEveryMinutes: 30 }),
    { nagEveryMinutes: 30 },
  );
});

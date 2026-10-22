import assert from 'node:assert/strict';
import test from 'node:test';
import type { IReminderTargetChannel } from '@zalobot/contracts';
import { buildCreateReminderRequest, createReminderDraft } from './reminder-create-form';
import { emptyReminderTargetDraft } from './reminder-target';

const now = new Date(2026, 9, 22, 10, 30);

test('a new draft defaults to one hour from now, by message, no repeat', () => {
  assert.deepEqual(createReminderDraft(now), {
    title: '',
    remindTimes: [{ value: '2026-10-22T11:30' }],
    notifyType: 'text',
    nag: { enabled: false, everyMinutes: 15, count: 3 },
    target: { chatId: '', userIds: [], mode: 'mention' },
  });
});

test('builds the request with a trimmed title and an ISO time', () => {
  const result = buildCreateReminderRequest(
    {
      title: '  uống thuốc ',
      remindTimes: [{ value: '2026-10-22T21:00', repeatType: 'daily' }],
      notifyType: 'call',
      nag: { enabled: true, everyMinutes: 10, count: 2 },
      target: emptyReminderTargetDraft(),
    },
    now,
  );
  assert.deepEqual(result, {
    ok: true,
    request: {
      title: 'uống thuốc',
      remindTimes: [
        {
          remindAt: new Date(2026, 9, 22, 21, 0).toISOString(),
          repeatType: 'daily',
          repeatWeekdays: [],
        },
      ],
      notifyType: 'call',
      nagEveryMinutes: 10,
      nagCount: 2,
    },
  });
});

test('rejects an empty title, a missing time and a time in the past', () => {
  const base = { ...createReminderDraft(now), title: 'x' };
  assert.deepEqual(buildCreateReminderRequest({ ...base, title: ' ' }, now), {
    ok: false,
    error: 'titleRequired',
  });
  assert.deepEqual(buildCreateReminderRequest({ ...base, remindTimes: [{ value: '' }] }, now), {
    ok: false,
    error: 'remindAtRequired',
  });
  assert.deepEqual(
    buildCreateReminderRequest({ ...base, remindTimes: [{ value: '2026-10-22T10:00' }] }, now),
    {
      ok: false,
      error: 'pastTime',
    },
  );
  // The current minute is still accepted.
  assert.equal(
    buildCreateReminderRequest({ ...base, remindTimes: [{ value: '2026-10-22T10:30' }] }, now).ok,
    true,
  );
});

const SELF: IReminderTargetChannel = { id: '111', name: 'Dat', type: 'user', isSelf: true };
const GROUP: IReminderTargetChannel = { id: 'g1', name: 'Nhà mình', type: 'group' };

test('with chats loaded the target defaults to the private chat', () => {
  const result = buildCreateReminderRequest({ ...createReminderDraft(now), title: 'Họp' }, now, [
    SELF,
    GROUP,
  ]);
  assert.equal(result.ok && result.request.chatId, '111');
  assert.equal(result.ok && result.request.remindUserIds, undefined);
});

test('a group reminder sends its people and mode', () => {
  const result = buildCreateReminderRequest(
    {
      ...createReminderDraft(now),
      title: 'Họp',
      target: { chatId: 'g1', userIds: ['222'], mode: 'direct' },
    },
    now,
    [SELF, GROUP],
  );
  assert.equal(result.ok && result.request.chatId, 'g1');
  assert.deepEqual(result.ok && result.request.remindUserIds, ['222']);
  assert.equal(result.ok && result.request.remindMode, 'direct');
});

test('dashboard-owner must pick a chat; a call only goes to the private chat', () => {
  const base = { ...createReminderDraft(now), title: 'Họp' };
  assert.deepEqual(buildCreateReminderRequest(base, now, [GROUP]), {
    ok: false,
    error: 'channelRequired',
  });
  assert.deepEqual(
    buildCreateReminderRequest(
      { ...base, notifyType: 'call', target: { chatId: 'g1', userIds: ['222'], mode: 'mention' } },
      now,
      [SELF, GROUP],
    ),
    { ok: false, error: 'callPrivateOnly' },
  );
});

test('a reminder can have several times', () => {
  const result = buildCreateReminderRequest(
    {
      ...createReminderDraft(now),
      title: 'Uống thuốc',
      remindTimes: [{ value: '2026-10-22T20:00' }, { value: '2026-10-22T12:00' }],
    },
    now,
  );
  assert.deepEqual(
    result.ok &&
      result.request.remindTimes?.map((time) => (typeof time === 'string' ? time : time.remindAt)),
    [new Date(2026, 9, 22, 12, 0).toISOString(), new Date(2026, 9, 22, 20, 0).toISOString()],
  );
});

test('reminding again must end before the next repeat of a time', () => {
  const base = {
    ...createReminderDraft(now),
    title: 'Uống thuốc',
    remindTimes: [{ value: '2026-10-22T20:00', repeatType: 'daily' as const }],
  };
  assert.deepEqual(
    buildCreateReminderRequest(
      { ...base, nag: { enabled: true, everyMinutes: 180, count: 10 } },
      now,
    ),
    { ok: false, error: 'nagTooLong' },
  );
  assert.equal(
    buildCreateReminderRequest(
      { ...base, nag: { enabled: true, everyMinutes: 120, count: 3 } },
      now,
    ).ok,
    true,
  );
});

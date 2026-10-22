import assert from 'node:assert/strict';
import test from 'node:test';
import type { IReminderTargetChannel } from '@zalobot/contracts';
import { buildCreateTaskRequest, emptyTaskDraft } from './task-create-form';

const NOW = new Date('2026-10-22T03:00:00.000Z');
const SELF: IReminderTargetChannel = { id: '111', name: 'Dat', type: 'user', isSelf: true };
const GROUP: IReminderTargetChannel = { id: '999', name: 'Nhà mình', type: 'group' };
const future = new Date(NOW.getTime() + 2 * 60 * 60 * 1000);
const pad = (n: number) => String(n).padStart(2, '0');
/** `datetime-local` value of a date in the test runner's time zone. */
const localInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;

test('builds the request with trimmed fields and an end-of-day due date', () => {
  assert.deepEqual(
    buildCreateTaskRequest({
      ...emptyTaskDraft(),
      title: ' Nộp báo cáo ',
      notes: '  quý 3 ',
      due: '2026-10-30',
    }),
    {
      ok: true,
      request: { title: 'Nộp báo cáo', notes: 'quý 3', due: '2026-10-30T23:59:59.000Z' },
    },
  );
});

test('notes and due date are optional', () => {
  assert.deepEqual(buildCreateTaskRequest({ ...emptyTaskDraft(), title: 'Mua sữa' }), {
    ok: true,
    request: { title: 'Mua sữa', notes: undefined, due: undefined },
  });
});

test('rejects an empty title', () => {
  assert.deepEqual(buildCreateTaskRequest({ ...emptyTaskDraft(), title: '   ' }), {
    ok: false,
    error: 'titleRequired',
  });
});

test("a reminder defaults to the user's own private chat", () => {
  assert.deepEqual(
    buildCreateTaskRequest(
      { ...emptyTaskDraft(), title: 'Họp', remindTimes: [{ value: localInput(future) }] },
      [SELF, GROUP],
      NOW,
    ),
    {
      ok: true,
      request: {
        title: 'Họp',
        notes: undefined,
        due: undefined,
        remindTimes: [new Date(localInput(future)).toISOString()],
        remindChatId: '111',
      },
    },
  );
});

test('a picked reminder chat wins over the default', () => {
  const result = buildCreateTaskRequest(
    {
      ...emptyTaskDraft(),
      title: 'Họp',
      remindTimes: [{ value: localInput(future) }],
      remindTarget: { chatId: '999', userIds: [], mode: 'mention' },
    },
    [SELF, GROUP],
    NOW,
  );
  assert.equal(result.ok && result.request.remindChatId, '999');
});

test('a reminder needs a chat when the user has no private chat (dashboard-owner)', () => {
  assert.deepEqual(
    buildCreateTaskRequest(
      { ...emptyTaskDraft(), title: 'Họp', remindTimes: [{ value: localInput(future) }] },
      [GROUP],
      NOW,
    ),
    { ok: false, error: 'remindChannelRequired' },
  );
});

test('rejects a reminder time in the past', () => {
  const past = new Date(NOW.getTime() - 10 * 60 * 1000);
  assert.deepEqual(
    buildCreateTaskRequest(
      { ...emptyTaskDraft(), title: 'Họp', remindTimes: [{ value: localInput(past) }] },
      [SELF],
      NOW,
    ),
    { ok: false, error: 'remindPastTime' },
  );
});

test('people and mode are sent for a group reminder only', () => {
  const draft = {
    ...emptyTaskDraft(),
    title: 'Họp',
    remindTimes: [{ value: localInput(future) }],
    remindTarget: { chatId: '999', userIds: ['222'], mode: 'direct' as const },
  };
  const result = buildCreateTaskRequest(draft, [SELF, GROUP], NOW);
  assert.equal(result.ok && result.request.remindChatId, '999');
  assert.deepEqual(result.ok && result.request.remindUserIds, ['222']);
  assert.equal(result.ok && result.request.remindMode, 'direct');

  const own = buildCreateTaskRequest(
    { ...draft, remindTarget: { ...draft.remindTarget, chatId: '111' } },
    [SELF, GROUP],
    NOW,
  );
  assert.equal(own.ok && own.request.remindUserIds, undefined);
});

test('several reminder times are sent sorted', () => {
  const later = new Date(future.getTime() + 60 * 60 * 1000);
  const result = buildCreateTaskRequest(
    {
      ...emptyTaskDraft(),
      title: 'Họp',
      remindTimes: [{ value: localInput(later) }, { value: localInput(future) }],
    },
    [SELF],
    NOW,
  );
  assert.deepEqual(result.ok && result.request.remindTimes, [
    new Date(localInput(future)).toISOString(),
    new Date(localInput(later)).toISOString(),
  ]);
});

test('empty reminder rows mean no reminder', () => {
  const result = buildCreateTaskRequest(
    { ...emptyTaskDraft(), title: 'Họp', remindTimes: [{ value: '' }, { value: '' }] },
    [],
    NOW,
  );
  assert.equal(result.ok && result.request.remindTimes, undefined);
});

test('a chat picked without any reminder time is not sent, and needs no chat', () => {
  const picked = buildCreateTaskRequest(
    {
      ...emptyTaskDraft(),
      title: 'Họp',
      remindTarget: { chatId: '999', userIds: [], mode: 'mention' },
    },
    [SELF, GROUP],
    NOW,
  );
  assert.equal(picked.ok && picked.request.remindChatId, undefined);
  // No private chat (dashboard-owner, legacy bot id) and no time: the task is still valid.
  assert.equal(
    buildCreateTaskRequest({ ...emptyTaskDraft(), title: 'Họp' }, [GROUP], NOW).ok,
    true,
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCreateReminderRequest, createReminderDraft } from './reminder-create-form';

const now = new Date(2026, 9, 22, 10, 30);

test('a new draft defaults to one hour from now, by message, no repeat', () => {
  assert.deepEqual(createReminderDraft(now), {
    title: '',
    remindAt: '2026-10-22T11:30',
    notifyType: 'text',
    repeatType: 'none',
  });
});

test('builds the request with a trimmed title and an ISO time', () => {
  const result = buildCreateReminderRequest(
    {
      title: '  uống thuốc ',
      remindAt: '2026-10-22T21:00',
      notifyType: 'call',
      repeatType: 'daily',
    },
    now,
  );
  assert.deepEqual(result, {
    ok: true,
    request: {
      title: 'uống thuốc',
      remindAt: new Date(2026, 9, 22, 21, 0).toISOString(),
      notifyType: 'call',
      repeatType: 'daily',
    },
  });
});

test('rejects an empty title, a missing time and a time in the past', () => {
  const base = { ...createReminderDraft(now), title: 'x' };
  assert.deepEqual(buildCreateReminderRequest({ ...base, title: ' ' }, now), {
    ok: false,
    error: 'titleRequired',
  });
  assert.deepEqual(buildCreateReminderRequest({ ...base, remindAt: '' }, now), {
    ok: false,
    error: 'remindAtRequired',
  });
  assert.deepEqual(buildCreateReminderRequest({ ...base, remindAt: '2026-10-22T10:00' }, now), {
    ok: false,
    error: 'pastTime',
  });
  // The current minute is still accepted.
  assert.equal(buildCreateReminderRequest({ ...base, remindAt: '2026-10-22T10:30' }, now).ok, true);
});

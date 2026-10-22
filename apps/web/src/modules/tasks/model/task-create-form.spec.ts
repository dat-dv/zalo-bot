import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCreateTaskRequest, emptyTaskDraft } from './task-create-form';

test('builds the request with trimmed fields and an end-of-day due date', () => {
  assert.deepEqual(
    buildCreateTaskRequest({ title: ' Nộp báo cáo ', notes: '  quý 3 ', due: '2026-10-30' }),
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

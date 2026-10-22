import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNagFields,
  emptyNagDraft,
  isNagChanged,
  nagDraftFrom,
  nagEveryOptions,
  reminderRuleError,
} from './reminder-nag';

test('reminding again is off by default and sends null to turn it off', () => {
  assert.deepEqual(buildNagFields(emptyNagDraft()), { nagEveryMinutes: null, nagCount: null });
  assert.deepEqual(buildNagFields({ enabled: true, everyMinutes: 30, count: 2 }), {
    nagEveryMinutes: 30,
    nagCount: 2,
  });
});

test('drafts from a saved rule and change detection', () => {
  assert.deepEqual(nagDraftFrom({ nagEveryMinutes: 45, nagCount: 4 }), {
    enabled: true,
    everyMinutes: 45,
    count: 4,
  });
  assert.equal(nagDraftFrom({}).enabled, false);
  assert.equal(isNagChanged(emptyNagDraft(), {}), false);
  assert.equal(isNagChanged(emptyNagDraft(), { nagEveryMinutes: 15, nagCount: 3 }), true);
  assert.equal(
    isNagChanged(
      { enabled: true, everyMinutes: 15, count: 3 },
      { nagEveryMinutes: 15, nagCount: 3 },
    ),
    false,
  );
});

test('a saved "every" outside the defaults stays selectable', () => {
  assert.ok(nagEveryOptions(45).includes(45));
  assert.deepEqual(nagEveryOptions(15), [5, 10, 15, 30, 60, 120]);
});

test('the rule is checked against each repeating time', () => {
  // 3 h × 10 = 30 h: longer than a day.
  const nag = { nagEveryMinutes: 180, nagCount: 10 };
  assert.equal(reminderRuleError([{ repeatType: 'none', repeatWeekdays: [] }], nag), null);
  assert.equal(reminderRuleError([{ repeatType: 'daily', repeatWeekdays: [] }], nag), 'nagTooLong');
  assert.equal(reminderRuleError([], { nagEveryMinutes: null, nagCount: null }), null);
});

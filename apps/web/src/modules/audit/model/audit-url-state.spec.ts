import assert from 'node:assert/strict';
import test from 'node:test';
import { APP_ROUTES } from '@zalobot/contracts';
import {
  AUDIT_PAGE_SIZE,
  DEFAULT_AUDIT_FILTER_STATE,
  countActiveAuditFilters,
  hasActiveAuditFilters,
  parseAuditFilterState,
  toAuditFilterQuery,
  toAuditListQuery,
} from './audit-url-state';

void test('an empty query string is the default state and serializes back to nothing', () => {
  const state = parseAuditFilterState(new URLSearchParams(''));
  assert.deepEqual(state, DEFAULT_AUDIT_FILTER_STATE);
  assert.equal(toAuditFilterQuery(state), '');
  assert.equal(hasActiveAuditFilters(state), false);
});

void test('the link from a transaction opens the log filtered to that record', () => {
  const href = APP_ROUTES.activityFor('finance_transactions', 'tx 1');
  const state = parseAuditFilterState(new URLSearchParams(href.split('?')[1]));
  assert.deepEqual(state.tables, ['finance_transactions']);
  assert.equal(state.recordId, 'tx 1');
  assert.equal(hasActiveAuditFilters(state), true);
});

void test('state round-trips through the query string; unknown values are dropped', () => {
  const state = parseAuditFilterState(
    new URLSearchParams(
      'table=debts&table=pg_user&action=remove&action=drop&source=legacy&actor=u1&from=2026-10-01&to=bad&technical=1&page=3',
    ),
  );
  assert.deepEqual(state, {
    tables: ['debts'],
    actions: ['remove'],
    sources: ['legacy'],
    actorIds: ['u1'],
    recordId: '',
    from: '2026-10-01',
    to: '',
    technical: true,
    page: 3,
  });
  assert.deepEqual(parseAuditFilterState(new URLSearchParams(toAuditFilterQuery(state))), state);
});

void test('the API query pages by AUDIT_PAGE_SIZE and spans whole local days', () => {
  const query = toAuditListQuery({
    ...DEFAULT_AUDIT_FILTER_STATE,
    from: '2026-10-01',
    to: '2026-10-02',
    page: 2,
  });
  assert.equal(query.limit, AUDIT_PAGE_SIZE);
  assert.equal(query.offset, AUDIT_PAGE_SIZE);
  assert.equal(query.startAt, new Date(2026, 9, 1).toISOString());
  assert.equal(query.endAt, new Date(2026, 9, 2, 23, 59, 59, 999).toISOString());
  assert.equal(query.tables, undefined);
  assert.equal(query.includeTechnical, undefined);
});

void test('the phone filter chip counts the sheet filters, not the record id or the page', () => {
  assert.equal(countActiveAuditFilters(DEFAULT_AUDIT_FILTER_STATE), 0);
  assert.equal(
    countActiveAuditFilters({
      ...DEFAULT_AUDIT_FILTER_STATE,
      recordId: 'tx1',
      page: 4,
    }),
    0,
  );
  assert.equal(
    countActiveAuditFilters({
      ...DEFAULT_AUDIT_FILTER_STATE,
      tables: ['debts'],
      actorIds: ['u1', 'u2'],
      from: '2026-10-01',
      to: '2026-10-23',
      technical: true,
    }),
    5,
  );
});

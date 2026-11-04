import test from 'node:test';
import assert from 'node:assert/strict';
import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { IRecurringOccurrenceItem } from '@zalobot/contracts';
import { ReportsController } from './reports.controller';
import type { ReportsTokenService } from './reports-token.service';
import type { AccessCodeRateLimiter } from './access-code-rate-limiter';
import type { UsersService } from '../users/users.service';
import type { FinanceService } from '../finance/finance.service';
import type { AuditService } from '../audit/audit.service';
import type { GoogleAuthService } from '../google/google-auth.service';
import type { CalendarService } from '../calendar/calendar.service';
import type { TasksService } from '../tasks/tasks.service';
import type { RemindersService } from '../reminders/reminders.service';
import type { RecurringTransactionService } from '../finance/recurring/recurring-transaction.service';

const PENDING: IRecurringOccurrenceItem[] = [
  {
    id: 'o1',
    ruleId: 'r1',
    type: 'expense',
    note: 'Tiền điện',
    category: 'Nhà',
    amount: null,
    dueAt: '2026-11-01T00:00:00.000Z',
  },
];

void test('the dashboard payload carries the periods waiting to be recorded', async () => {
  const controller = new ReportsController(
    {} as unknown as ConfigService,
    {
      sumPeriod: () => Promise.resolve({ income: 0, expense: 0, balance: 0 }),
      listRecentTransactions: () => Promise.resolve([]),
      getLedgerPosition: () =>
        Promise.resolve({ ledgerBalance: 0, savingsTotal: 0, runningBalances: new Map() }),
      getActiveDebts: () => Promise.resolve([]),
      toTransactionItems: () => Promise.resolve([]),
    } as unknown as FinanceService,
    { listRecent: () => Promise.resolve([]) } as unknown as AuditService,
    { isAuthorized: () => false } as unknown as GoogleAuthService,
    {
      listEvents: () => Promise.resolve([]),
      toItems: () => Promise.resolve([]),
    } as unknown as CalendarService,
    {
      listTasks: () => Promise.resolve([]),
      toItems: () => Promise.resolve([]),
    } as unknown as TasksService,
    { getUserUpcomingReminders: () => Promise.resolve([]) } as unknown as RemindersService,
    { isAdmin: () => false } as unknown as UsersService,
    { verifyAccessToken: () => '42' } as unknown as ReportsTokenService,
    {} as unknown as AccessCodeRateLimiter,
    { listPendingItems: () => Promise.resolve(PENDING) } as unknown as RecurringTransactionService,
  );

  const res = await controller.dashboard({
    headers: { authorization: 'Bearer valid-token' },
  } as unknown as Request);

  assert.deepEqual(res.data.recurringPending, PENDING);
});

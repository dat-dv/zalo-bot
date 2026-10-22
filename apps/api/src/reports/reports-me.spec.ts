import test from 'node:test';
import assert from 'node:assert/strict';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { IDashboardSessionUser } from '@zalobot/contracts';
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

const PROFILE: IDashboardSessionUser = {
  id: '42',
  name: 'Anh Đạt',
  avatarUrl: null,
  isAdmin: true,
  isDashboardOwner: false,
};

function createController(profileFor: string[]) {
  const tokens = {
    verifyAccessToken: (token: string) => {
      if (token !== 'valid-token') throw new UnauthorizedException();
      return '42';
    },
  } as unknown as ReportsTokenService;
  const users = {
    getSessionProfile: (userId: string | number) => {
      profileFor.push(String(userId));
      return Promise.resolve(PROFILE);
    },
  } as unknown as UsersService;
  return new ReportsController(
    {} as unknown as ConfigService,
    {} as unknown as FinanceService,
    {} as unknown as AuditService,
    {} as unknown as GoogleAuthService,
    {} as unknown as CalendarService,
    {} as unknown as TasksService,
    {} as unknown as RemindersService,
    users,
    tokens,
    {} as unknown as AccessCodeRateLimiter,
  );
}

void test('ReportsController.me returns the profile of the session user', async () => {
  const profileFor: string[] = [];
  const controller = createController(profileFor);

  const res = await controller.me({
    headers: { authorization: 'Bearer valid-token' },
  } as unknown as Request);

  assert.deepEqual(res, { data: PROFILE });
  assert.deepEqual(profileFor, ['42']);
});

void test('ReportsController.me rejects a request without a valid token', async () => {
  const profileFor: string[] = [];
  const controller = createController(profileFor);

  await assert.rejects(
    () => controller.me({ headers: {} } as unknown as Request),
    UnauthorizedException,
  );
  await assert.rejects(
    () => controller.me({ headers: { authorization: 'Bearer bad' } } as unknown as Request),
    UnauthorizedException,
  );
  assert.deepEqual(profileFor, []);
});

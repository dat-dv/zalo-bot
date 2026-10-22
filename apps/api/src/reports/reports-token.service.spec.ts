import test from 'node:test';
import assert from 'node:assert/strict';
import { ReportsTokenService } from './reports-token.service';

function createService(loginCode?: string): ReportsTokenService {
  const config = {
    get: (key: string) => (key === 'reports.dashboardLoginCode' ? loginCode : undefined),
  };
  return new ReportsTokenService(config as never, {} as never);
}

void test('matchesStaticLoginCode accepts the configured code in any dash or space layout', () => {
  const service = createService('8930-91');
  assert.equal(service.matchesStaticLoginCode('893091'), true);
  assert.equal(service.matchesStaticLoginCode('893-091'), true);
  assert.equal(service.matchesStaticLoginCode(' 893 091 '), true);
});

void test('matchesStaticLoginCode rejects other codes and malformed input', () => {
  const service = createService('893091');
  assert.equal(service.matchesStaticLoginCode('893092'), false);
  assert.equal(service.matchesStaticLoginCode(''), false);
  assert.equal(service.matchesStaticLoginCode('89309'), false);
});

void test('matchesStaticLoginCode is off when DASHBOARD_LOGIN_CODE is empty or malformed', () => {
  assert.equal(createService(undefined).matchesStaticLoginCode('893091'), false);
  assert.equal(createService('').matchesStaticLoginCode('893091'), false);
  assert.equal(createService('ABCD-1234').matchesStaticLoginCode('ABCD-1234'), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { ReportsTokenService } from './reports-token.service';

function createService(loginCode?: string): ReportsTokenService {
  const config = {
    get: (key: string) => (key === 'reports.dashboardLoginCode' ? loginCode : undefined),
  };
  return new ReportsTokenService(config as never, {} as never);
}

void test('matchesStaticLoginCode accepts the configured code in any case or dash layout', () => {
  const service = createService('HRYJ-ZP2T');
  assert.equal(service.matchesStaticLoginCode('HRYJ-ZP2T'), true);
  assert.equal(service.matchesStaticLoginCode('hryjzp2t'), true);
  assert.equal(service.matchesStaticLoginCode(' hryj zp2t '), true);
});

void test('matchesStaticLoginCode rejects other codes and malformed input', () => {
  const service = createService('HRYJ-ZP2T');
  assert.equal(service.matchesStaticLoginCode('HRYJ-ZP2V'), false);
  assert.equal(service.matchesStaticLoginCode(''), false);
  assert.equal(service.matchesStaticLoginCode('HRYJ-ZP2'), false);
});

void test('matchesStaticLoginCode is off when DASHBOARD_LOGIN_CODE is empty or malformed', () => {
  assert.equal(createService(undefined).matchesStaticLoginCode('HRYJ-ZP2T'), false);
  assert.equal(createService('').matchesStaticLoginCode('HRYJ-ZP2T'), false);
  assert.equal(createService('ILOU-1234').matchesStaticLoginCode('ILOU-1234'), false);
});

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DeployNotifyGuard } from './deploy-notify.guard';

function guardWith(token: string | undefined): DeployNotifyGuard {
  const config = {
    get: (key: string) => (key === 'deploy.notifyToken' ? token : undefined),
  } as unknown as ConfigService;
  return new DeployNotifyGuard(config);
}

function contextFor(req: { headers?: Record<string, string>; query?: Record<string, string> }) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: req.headers ?? {}, query: req.query ?? {} }),
    }),
  } as unknown as ExecutionContext;
}

void test('DeployNotifyGuard is fail-closed when DEPLOY_NOTIFY_TOKEN is not configured', () => {
  assert.throws(
    () => guardWith(undefined).canActivate(contextFor({ query: { token: 'anything' } })),
    ForbiddenException,
  );
});

void test('DeployNotifyGuard accepts the token from header, bearer or query', () => {
  const guard = guardWith('s3cret');
  assert.equal(guard.canActivate(contextFor({ headers: { 'x-deploy-token': 's3cret' } })), true);
  assert.equal(
    guard.canActivate(contextFor({ headers: { authorization: 'Bearer s3cret' } })),
    true,
  );
  assert.equal(guard.canActivate(contextFor({ query: { token: 's3cret' } })), true);
});

void test('DeployNotifyGuard rejects missing or wrong tokens', () => {
  const guard = guardWith('s3cret');
  assert.throws(() => guard.canActivate(contextFor({})), UnauthorizedException);
  assert.throws(
    () => guard.canActivate(contextFor({ query: { token: 's3cret-but-longer' } })),
    UnauthorizedException,
  );
});

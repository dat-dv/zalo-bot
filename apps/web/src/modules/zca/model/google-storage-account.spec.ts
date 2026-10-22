import assert from 'node:assert/strict';
import test from 'node:test';
import { AxiosError, AxiosHeaders } from 'axios';
import { isForbiddenError, isStorageReady, storageLoginLabelKey } from './google-storage-account';

function httpError(status: number): AxiosError {
  const headers = new AxiosHeaders();
  return new AxiosError('failed', 'ERR', { headers }, undefined, {
    status,
    statusText: '',
    headers,
    config: { headers },
    data: null,
  });
}

void test('isForbiddenError is true only for a 403 HTTP error', () => {
  assert.equal(isForbiddenError(httpError(403)), true);
  assert.equal(isForbiddenError(httpError(500)), false);
  assert.equal(isForbiddenError(new Error('boom')), false);
});

void test('storageLoginLabelKey follows the account state', () => {
  assert.equal(
    storageLoginLabelKey({ connected: false, email: null, hasStorageScopes: false }),
    'zca.googleAccount.login',
  );
  assert.equal(
    storageLoginLabelKey({ connected: true, email: 'a@gmail.com', hasStorageScopes: false }),
    'zca.googleAccount.regrant',
  );
  assert.equal(
    storageLoginLabelKey({ connected: true, email: 'a@gmail.com', hasStorageScopes: true }),
    'zca.googleAccount.switch',
  );
});

void test('isStorageReady needs a connection with Drive and Photos scopes', () => {
  assert.equal(isStorageReady({ connected: true, email: null, hasStorageScopes: true }), true);
  assert.equal(isStorageReady({ connected: true, email: null, hasStorageScopes: false }), false);
  assert.equal(isStorageReady({ connected: false, email: null, hasStorageScopes: true }), false);
});

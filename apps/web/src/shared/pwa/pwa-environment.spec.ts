import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isIosUserAgent,
  isZaloInAppUserAgent,
  pickVersionToInstall,
  shouldRegisterServiceWorker,
} from './pwa-environment';

void test('isIosUserAgent detects iPhone and iPadOS desktop user agents', () => {
  assert.equal(isIosUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), true);
  assert.equal(isIosUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5), true);
  assert.equal(isIosUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0), false);
  assert.equal(isIosUserAgent('Mozilla/5.0 (Linux; Android 15)'), false);
});

void test('isZaloInAppUserAgent detects the Zalo in-app browser', () => {
  assert.equal(isZaloInAppUserAgent('Mozilla/5.0 (Linux; Android 15) Zalo android/12'), true);
  assert.equal(isZaloInAppUserAgent('Mozilla/5.0 (Linux; Android 15) Chrome/130'), false);
});

void test('shouldRegisterServiceWorker only in a secure production build', () => {
  const ok = { isProduction: true, isSecureContext: true, hasServiceWorker: true };
  assert.equal(shouldRegisterServiceWorker(ok), true);
  assert.equal(shouldRegisterServiceWorker({ ...ok, isProduction: false }), false);
  assert.equal(shouldRegisterServiceWorker({ ...ok, isSecureContext: false }), false);
  assert.equal(shouldRegisterServiceWorker({ ...ok, hasServiceWorker: false }), false);
});

void test('pickVersionToInstall returns a deployed version that differs from the running one', () => {
  assert.equal(pickVersionToInstall('1.0.1', { version: '1.0.2' }), '1.0.2');
  // A rollback is a deploy too.
  assert.equal(pickVersionToInstall('1.0.2', { version: '1.0.1' }), '1.0.1');
});

void test('pickVersionToInstall ignores the same version and malformed files', () => {
  assert.equal(pickVersionToInstall('1.0.1', { version: '1.0.1' }), null);
  for (const body of [null, undefined, '1.0.2', 2, {}, { version: 2 }, { version: '' }]) {
    assert.equal(pickVersionToInstall('1.0.1', body), null);
  }
});

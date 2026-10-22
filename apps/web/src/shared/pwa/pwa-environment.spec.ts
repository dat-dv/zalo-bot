import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isIosUserAgent,
  isZaloInAppUserAgent,
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

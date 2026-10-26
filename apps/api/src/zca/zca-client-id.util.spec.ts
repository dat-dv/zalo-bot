import test from 'node:test';
import assert from 'node:assert/strict';
import { captureClientId } from './zca-client-id.util';

void test('captureClientId keeps the first clock read of the synchronous send', async () => {
  const realNow = Date.now;
  let builtClientId: number | undefined;
  const { result, clientId } = captureClientId(async () => {
    // Like zca-js: the params (and clientId) are built before the first await.
    builtClientId = Date.now();
    Date.now();
    await Promise.resolve();
    return { msgId: 1 };
  });

  assert.deepEqual(await result, { msgId: 1 });
  assert.equal(clientId, String(builtClientId));
  assert.equal(Date.now, realNow, 'the real clock is back');
});

void test('captureClientId does not keep clock reads after the first await', async () => {
  const { result, clientId } = captureClientId(async () => {
    await Promise.resolve();
    Date.now();
  });
  await result;
  assert.equal(clientId, undefined);
});

void test('captureClientId puts the clock back when send throws synchronously', () => {
  const realNow = Date.now;
  assert.throws(
    () =>
      captureClientId(() => {
        Date.now();
        throw new Error('Missing threadId');
      }),
    /Missing threadId/,
  );
  assert.equal(Date.now, realNow);
});

void test('captureClientId passes a rejected send through', async () => {
  const { result, clientId } = captureClientId(() => {
    Date.now();
    return Promise.reject(new Error('network'));
  });
  assert.ok(clientId);
  await assert.rejects(result, /network/);
});

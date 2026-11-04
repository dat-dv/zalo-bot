import test from 'node:test';
import assert from 'node:assert/strict';
import { UPDATE_RELOAD_FALLBACK_MS, createPwaUpdater, type SkipWaitingTarget } from './pwa-update';

function setup(worker: SkipWaitingTarget | null | 'throws') {
  const calls = { reloads: 0, starts: 0, posted: 0, delays: [] as number[] };
  const scheduled: Array<() => void> = [];
  const updater = createPwaUpdater({
    getWaitingWorker: () =>
      worker === 'throws' ? Promise.reject(new Error('gone')) : Promise.resolve(worker),
    reload: () => {
      calls.reloads += 1;
    },
    schedule: (callback, delayMs) => {
      calls.delays.push(delayMs);
      scheduled.push(callback);
    },
    onStart: () => {
      calls.starts += 1;
    },
  });
  return { calls, scheduled, updater };
}

function workerCounting(onPost: () => void): SkipWaitingTarget {
  return { postMessage: onPost };
}

void test('a user update asks the waiting worker and waits for it to take over', async () => {
  let posted = 0;
  const { calls, updater } = setup(workerCounting(() => (posted += 1)));
  await updater.apply({ fallback: true });
  assert.equal(posted, 1);
  assert.equal(calls.starts, 1);
  assert.equal(calls.reloads, 0);
  assert.deepEqual(calls.delays, [UPDATE_RELOAD_FALLBACK_MS]);
});

void test('a user update reloads when the worker never takes over', async () => {
  const { calls, scheduled, updater } = setup(workerCounting(() => undefined));
  await updater.apply({ fallback: true });
  scheduled[0]?.();
  assert.equal(calls.reloads, 1);
});

void test('the fallback does not reload again after controllerchange reloaded', async () => {
  const { calls, scheduled, updater } = setup(workerCounting(() => undefined));
  await updater.apply({ fallback: true });
  updater.reloadOnce();
  scheduled[0]?.();
  assert.equal(calls.reloads, 1);
});

void test('a user update reloads at once when no worker is waiting', async () => {
  const { calls, updater } = setup(null);
  await updater.apply({ fallback: true });
  assert.equal(calls.reloads, 1);
  assert.deepEqual(calls.delays, []);
});

void test('a user update reloads at once when the worker cannot be reached', async () => {
  const rejected = setup('throws');
  await rejected.updater.apply({ fallback: true });
  assert.equal(rejected.calls.reloads, 1);

  const refused = setup(
    workerCounting(() => {
      throw new Error('redundant');
    }),
  );
  await refused.updater.apply({ fallback: true });
  assert.equal(refused.calls.reloads, 1);
});

void test('pressing the button twice only starts one update', async () => {
  let posted = 0;
  const { calls, updater } = setup(workerCounting(() => (posted += 1)));
  await Promise.all([updater.apply({ fallback: true }), updater.apply({ fallback: true })]);
  assert.equal(posted, 1);
  assert.equal(calls.starts, 1);
  assert.equal(calls.delays.length, 1);
});

void test('the silent update never reloads by itself or shows progress', async () => {
  let posted = 0;
  const waiting = setup(workerCounting(() => (posted += 1)));
  await waiting.updater.apply({ fallback: false });
  assert.equal(posted, 1);
  assert.equal(waiting.calls.reloads, 0);
  assert.equal(waiting.calls.starts, 0);
  assert.deepEqual(waiting.calls.delays, []);

  for (const worker of [null, 'throws'] as const) {
    const { calls, updater } = setup(worker);
    await updater.apply({ fallback: false });
    assert.equal(calls.reloads, 0);
  }
});

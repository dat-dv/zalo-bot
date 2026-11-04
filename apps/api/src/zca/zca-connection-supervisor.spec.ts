import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  ZCA_DOWN_ALERT_AFTER_MS,
  ZCA_LISTENER_RESTARTS_BEFORE_LOGIN,
  ZCA_RECONNECT_DELAYS_MS,
  ZCA_SLOW_RETRY_MS,
  ZCA_STABLE_AFTER_MS,
  ZcaConnectionSupervisor,
  type ZcaConnectionAlert,
} from './zca-connection-supervisor';

function harness(options: { loginFails?: boolean; restartThrows?: boolean } = {}) {
  let clock = 0;
  let nextId = 1;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const alerts: ZcaConnectionAlert[] = [];
  const calls = { restarts: 0, logins: 0 };

  const supervisor = new ZcaConnectionSupervisor({
    restartListener: () => {
      calls.restarts += 1;
      if (options.restartThrows) throw new Error('no api');
    },
    login: () => {
      calls.logins += 1;
      return options.loginFails ? Promise.reject(new Error('expired')) : Promise.resolve();
    },
    alert: (alert) => alerts.push(alert),
    now: () => clock,
    setTimer: (callback, delayMs) => {
      const id = nextId++;
      timers.set(id, { at: clock + delayMs, callback });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: (timer) => timers.delete(timer as unknown as number),
  });

  const advance = async (ms: number): Promise<void> => {
    const end = clock + ms;
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, t]) => t.at <= end)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      clock = due[1].at;
      due[1].callback();
      await Promise.resolve();
      await Promise.resolve();
    }
    clock = end;
  };

  return { supervisor, alerts, calls, advance, timers };
}

void test('a close is retried with backoff, then falls back to a full login', async () => {
  const { supervisor, calls, advance } = harness({ restartThrows: true });
  supervisor.markConnected();
  await advance(ZCA_STABLE_AFTER_MS);

  supervisor.markClosed(1006);
  assert.equal(supervisor.snapshot().state, 'reconnecting');

  await advance(ZCA_RECONNECT_DELAYS_MS[0] - 1);
  assert.equal(calls.restarts, 0);
  await advance(1);
  assert.equal(calls.restarts, 1);
  await advance(ZCA_RECONNECT_DELAYS_MS[1]);
  assert.equal(calls.restarts, ZCA_LISTENER_RESTARTS_BEFORE_LOGIN);
  assert.equal(calls.logins, 0);
  await advance(ZCA_RECONNECT_DELAYS_MS[2]);
  assert.equal(calls.logins, 1);
});

void test('nothing reconnects after a deliberate stop', async () => {
  const { supervisor, calls, alerts, advance, timers } = harness();
  supervisor.markConnected();
  supervisor.markStopped();
  supervisor.markClosed(1000);

  await advance(ZCA_DOWN_ALERT_AFTER_MS * 2);
  assert.equal(calls.restarts + calls.logins, 0);
  assert.equal(alerts.length, 0);
  assert.equal(timers.size, 0);
  assert.equal(supervisor.snapshot().state, 'logged_out');
});

void test('a short blip stays quiet', async () => {
  const { supervisor, alerts, advance } = harness();
  supervisor.markConnected();
  supervisor.markClosed(1006);
  await advance(ZCA_RECONNECT_DELAYS_MS[0]);
  supervisor.markConnected();
  await advance(ZCA_DOWN_ALERT_AFTER_MS + ZCA_STABLE_AFTER_MS);
  assert.equal(alerts.length, 0);
  assert.equal(supervisor.snapshot().downSince, null);
});

void test('a long outage alerts once and reports recovery once', async () => {
  const { supervisor, alerts, advance } = harness({ restartThrows: true });
  supervisor.markConnected();
  await advance(ZCA_STABLE_AFTER_MS);
  supervisor.markClosed(1006);

  await advance(ZCA_DOWN_ALERT_AFTER_MS);
  assert.deepEqual(alerts, [{ kind: 'down', state: 'reconnecting', closeCode: 1006 }]);
  await advance(ZCA_DOWN_ALERT_AFTER_MS);
  assert.equal(alerts.length, 1);

  supervisor.markConnected();
  await advance(ZCA_STABLE_AFTER_MS);
  assert.equal(alerts.length, 2);
  assert.equal(alerts[1].kind, 'restored');
});

void test('a socket that connects then drops keeps backing off', async () => {
  const { supervisor, calls, advance } = harness();
  supervisor.markConnected();
  supervisor.markClosed(1006);
  await advance(ZCA_RECONNECT_DELAYS_MS[0]);
  supervisor.markConnected();
  supervisor.markClosed(1006);
  await advance(ZCA_RECONNECT_DELAYS_MS[1] - 1);
  assert.equal(calls.restarts, 1, 'second retry waits the longer delay');
  await advance(1);
  assert.equal(calls.restarts, 2);
});

void test('repeated login failures mark the session expired and slow down', async () => {
  const { supervisor, alerts, calls, advance } = harness({ loginFails: true, restartThrows: true });
  supervisor.markStarted();
  supervisor.markClosed(1006);
  await advance(
    ZCA_RECONNECT_DELAYS_MS.reduce((sum, d) => sum + d, 0) + ZCA_RECONNECT_DELAYS_MS[3],
  );

  assert.equal(supervisor.snapshot().state, 'session_expired');
  assert.equal(calls.logins, 3);
  assert.equal(alerts.filter((a) => a.kind === 'down').length, 1);
  await advance(ZCA_SLOW_RETRY_MS - 1);
  assert.equal(calls.logins, 3);
  await advance(1);
  assert.equal(calls.logins, 4);
});

void test('being replaced by another login alerts at once and retries slowly', async () => {
  const { supervisor, alerts, calls, advance } = harness();
  supervisor.markConnected();
  await advance(ZCA_STABLE_AFTER_MS);
  supervisor.markClosed(3000);

  assert.equal(supervisor.snapshot().state, 'replaced');
  assert.equal(alerts.length, 1);
  await advance(ZCA_RECONNECT_DELAYS_MS[3]);
  assert.equal(calls.restarts, 0);
  await advance(ZCA_SLOW_RETRY_MS);
  assert.equal(calls.restarts, 1);
});

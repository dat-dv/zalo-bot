import test from 'node:test';
import assert from 'node:assert/strict';
import { launchZalo, ZALO_LINKS, type ZaloLaunchHost } from './zalo-app-link';

interface FakeHost extends ZaloLaunchHost {
  navigated: string[];
  opened: string[];
  fireTimer: () => void;
  leave: () => void;
  listenerCount: () => number;
}

function createFakeHost(tabAllowed = true): FakeHost {
  const navigated: string[] = [];
  const opened: string[] = [];
  let timer: (() => void) | undefined;
  let leaveListener: (() => void) | undefined;
  return {
    navigated,
    opened,
    navigate: (url) => {
      navigated.push(url);
    },
    openTab: (url) => {
      opened.push(url);
      return tabAllowed;
    },
    onLeave: (listener) => {
      leaveListener = listener;
      return () => {
        leaveListener = undefined;
      };
    },
    setTimer: (callback) => {
      timer = callback;
      return () => {
        timer = undefined;
      };
    },
    fireTimer: () => timer?.(),
    leave: () => leaveListener?.(),
    listenerCount: () => (leaveListener ? 1 : 0),
  };
}

void test('ZALO_LINKS opens the app home screen and falls back to Zalo Web', () => {
  assert.equal(ZALO_LINKS.APP, 'zalo://');
  assert.equal(ZALO_LINKS.WEB, 'https://chat.zalo.me');
});

void test('launchZalo opens Zalo Web when no app takes the deep link', () => {
  const host = createFakeHost();
  launchZalo(host);
  assert.deepEqual(host.navigated, ['zalo://']);
  host.fireTimer();
  assert.deepEqual(host.opened, ['https://chat.zalo.me']);
  assert.deepEqual(host.navigated, ['zalo://']);
  assert.equal(host.listenerCount(), 0);
});

void test('launchZalo navigates to Zalo Web when the new tab is blocked', () => {
  const host = createFakeHost(false);
  launchZalo(host);
  host.fireTimer();
  assert.deepEqual(host.navigated, ['zalo://', 'https://chat.zalo.me']);
});

void test('launchZalo skips the fallback once the app opened', () => {
  const host = createFakeHost();
  launchZalo(host);
  host.leave();
  host.fireTimer();
  assert.deepEqual(host.opened, []);
  assert.deepEqual(host.navigated, ['zalo://']);
  assert.equal(host.listenerCount(), 0);
});

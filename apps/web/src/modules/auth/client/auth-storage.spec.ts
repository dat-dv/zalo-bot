import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import {
  captureDashboardToken,
  getAccessToken,
  setAccessToken,
  clearAccessToken,
} from './auth-storage';

class MockLocalStorage {
  private store = new Map<string, string>();
  public getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  public setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  public removeItem(key: string): void {
    this.store.delete(key);
  }
  public clear(): void {
    this.store.clear();
  }
}

beforeEach(() => {
  const storage = new MockLocalStorage();
  const mockLocation = {
    pathname: '/dashboard',
    search: '',
    hash: '',
    replace: (url: string) => {
      mockLocation.pathname = url;
    },
  };
  const mockHistory = {
    replaceState: (_state: unknown, _title: string, url: string) => {
      const parsed = new URL(url, 'http://localhost');
      mockLocation.pathname = parsed.pathname;
      mockLocation.search = parsed.search;
      mockLocation.hash = parsed.hash;
    },
  };

  (globalThis as unknown as { window: unknown }).window = {
    localStorage: storage,
    location: mockLocation,
    history: mockHistory,
  };
});

void test('captureDashboardToken captures dashboard_token from hash and cleans URL', () => {
  window.location.pathname = '/dashboard';
  window.location.hash = '#dashboard_token=header.payload.sig';

  captureDashboardToken();

  assert.equal(getAccessToken(), 'header.payload.sig');
  assert.equal(window.location.pathname, '/dashboard');
  assert.equal(window.location.hash, '');
});

void test('captureDashboardToken captures token from query param and cleans URL', () => {
  window.location.pathname = '/dashboard';
  window.location.search = '?token=header.payload.sig&other=1';

  captureDashboardToken();

  assert.equal(getAccessToken(), 'header.payload.sig');
  assert.equal(window.location.pathname, '/dashboard');
  assert.equal(window.location.search, '?other=1');
});

void test('captureDashboardToken redirects exchange tokens to /api/access', () => {
  window.location.pathname = '/dashboard';
  window.location.search = '?token=rawExchangeToken123';

  captureDashboardToken();

  assert.equal(window.location.pathname, '/api/access?token=rawExchangeToken123');
});

void test('setAccessToken and clearAccessToken manage token in localStorage', () => {
  setAccessToken('my-token');
  assert.equal(getAccessToken(), 'my-token');
  clearAccessToken();
  assert.equal(getAccessToken(), null);
});

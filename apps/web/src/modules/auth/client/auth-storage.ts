const ACCESS_TOKEN_KEY = 'zalobot.dashboard.access-token';

export function getAccessToken(): string | null {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function captureDashboardToken(): void {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const token = fragment.get('dashboard_token');
  if (!token) return;
  setAccessToken(token);
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}

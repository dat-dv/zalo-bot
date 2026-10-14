const ACCESS_TOKEN_KEY = 'zalobot.dashboard.access-token';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export function clearAccessToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export function captureDashboardToken(): void {
  if (typeof window === 'undefined') return;

  try {
    // 1. Check hash first (#dashboard_token=... or #token=...)
    const rawHash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(rawHash);
    const hashToken = hashParams.get('dashboard_token') || hashParams.get('token');

    // 2. Check query params (?dashboard_token=... or ?token=...)
    const searchParams = new URLSearchParams(window.location.search);
    const queryToken = searchParams.get('dashboard_token') || searchParams.get('token');

    const token = hashToken || queryToken;

    if (token) {
      // If token is an exchange token (one-time exchange string without '.' used by Zalo bot),
      // redirect immediately to /api/access to consume and establish the dashboard session.
      const isExchangeToken = !token.includes('.');
      if (isExchangeToken && !hashToken) {
        window.location.replace(`/api/access?token=${encodeURIComponent(token)}`);
        return;
      }

      setAccessToken(token);

      // Clean token parameters from URL via replaceState
      searchParams.delete('dashboard_token');
      searchParams.delete('token');
      const cleanSearch = searchParams.toString() ? `?${searchParams.toString()}` : '';
      window.history.replaceState(null, '', `${window.location.pathname}${cleanSearch}`);
    }
  } catch (error) {
    console.error('Failed to capture dashboard token:', error);
  }
}

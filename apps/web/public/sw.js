/*
 * zalobot service worker: offline shell + update handoff. Hand-written (no build step), so keep
 * it small and plain JS. Registered as /sw.js?v=<app version>: a new version means a new worker,
 * and its install/activate rotates the caches below.
 *
 * What is cached on purpose:
 * - Page navigations: network first, last good copy of each page as fallback, then /offline.html.
 * - /_next/static/*: hashed and immutable, so cache first.
 * - Same-origin images/icons/fonts: stale-while-revalidate.
 * Never touched: non-GET, other origins, and the backend paths below. Finance data must always
 * come from the server, and the sign-in link / OAuth redirects must reach it untouched.
 */

const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE_PREFIX = 'zalobot-';
const SHELL_CACHE = `${CACHE_PREFIX}shell-${VERSION}`;
const PAGES_CACHE = `${CACHE_PREFIX}pages-${VERSION}`;
const ASSETS_CACHE = `${CACHE_PREFIX}assets-${VERSION}`;
const OFFLINE_URL = '/offline.html';
const SHELL_URLS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/favicon.svg',
];
const BACKEND_PREFIXES = ['/api/', '/webhook', '/zalo/', '/oauth2callback'];
const STATIC_ASSET = /\.(?:png|jpe?g|gif|svg|ico|webp|avif|woff2?)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)));
  // No skipWaiting here: the page asks the user first, then sends SKIP_WAITING.
});

self.addEventListener('activate', (event) => {
  const current = new Set([SHELL_CACHE, PAGES_CACHE, ASSETS_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && !current.has(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (BACKEND_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
  } else if (STATIC_ASSET.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event));
  }
});

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGES_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached =
      (await caches.match(request)) || (await caches.match(request, { ignoreSearch: true }));
    return cached || (await caches.match(OFFLINE_URL)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(ASSETS_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(event) {
  const { request } = event;
  const cached = await caches.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(ASSETS_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);
  // Keep the worker alive until the background refresh has been stored.
  event.waitUntil(refresh);
  return cached || (await refresh) || Response.error();
}

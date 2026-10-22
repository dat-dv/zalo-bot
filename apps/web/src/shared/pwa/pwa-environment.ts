/** Pure checks about where the dashboard runs; inputs are passed in so specs need no browser. */

export function isIosUserAgent(userAgent: string, maxTouchPoints = 0): boolean {
  // iPadOS reports a desktop Mac user agent, so touch support tells it apart.
  return (
    /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
  );
}

export function isZaloInAppUserAgent(userAgent: string): boolean {
  return /Zalo/i.test(userAgent);
}

export function shouldRegisterServiceWorker(env: {
  isProduction: boolean;
  isSecureContext: boolean;
  hasServiceWorker: boolean;
}): boolean {
  // Dev runs `next dev` with HMR; a worker there would serve stale chunks.
  return env.isProduction && env.isSecureContext && env.hasServiceWorker;
}

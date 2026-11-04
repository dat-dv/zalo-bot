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

/**
 * Reads /version.json and returns the version to install, or null when there is nothing to do:
 * same version as the running page, or a body that is not the expected shape.
 */
export function pickVersionToInstall(currentVersion: string, body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('version' in body)) return null;
  const { version } = body;
  if (typeof version !== 'string' || version === '') return null;
  return version === currentVersion ? null : version;
}

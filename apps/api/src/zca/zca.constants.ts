export const ZCA_MODULE_OPTIONS = 'ZCA_MODULE_OPTIONS';

export const ZCA_DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/** The ZCA directory (groups, friends, aliases) is re-fetched automatically once it is older than this. */
export const ZCA_DIRECTORY_SOFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Redis drops a directory snapshot nobody has refreshed for this long. */
export const ZCA_DIRECTORY_HARD_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Forced refreshes (dashboard buttons) closer together than this reuse the last result to avoid Zalo 429s. */
export const ZCA_DIRECTORY_REFRESH_COOLDOWN_MS = 30_000;

/** Minimum gap between automatic (cold or stale) fetch attempts, so a failing Zalo is not hammered. */
export const ZCA_DIRECTORY_AUTO_RETRY_MS = 5 * 60 * 1000;

export const zcaDirectoryRedisKey = (ownId: string): string => `zca:directory:${ownId}`;

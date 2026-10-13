import nodefetch from 'node-fetch';
import { createSharpImageMetadataGetter } from './zca-metadata.util';

/**
 * Pre-configured imageMetadataGetter using Sharp.
 * Used in Zalo constructor: new Zalo({ imageMetadataGetter })
 */
export const imageMetadataGetter = createSharpImageMetadataGetter();
export * from './zca-metadata.util';

/**
 * Creates a fetch polyfill function compatible with zca-js.
 * Crucially, ensures `response.headers.getSetCookie()` exists so that multi-cookie
 * Set-Cookie headers with commas (such as Expires=Wed, 14-Oct-2026...) are NOT split
 * incorrectly by fallback .split(", "), preserving critical session cookies during QR login.
 */
export function createFetchPolyfill(agent?: unknown) {
  if (agent) {
    return async (url: any, opts: any) => {
      const res = await (nodefetch as any)(url, opts);
      if (
        typeof res.headers.getSetCookie !== 'function' &&
        typeof (res.headers as any).raw === 'function'
      ) {
        (res.headers as any).getSetCookie = () =>
          (res.headers as any).raw()['set-cookie'] || [];
      }
      return res;
    };
  }
  return globalThis.fetch;
}


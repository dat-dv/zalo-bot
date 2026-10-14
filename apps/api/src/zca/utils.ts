import nodefetch from 'node-fetch';
import { createSharpImageMetadataGetter } from './zca-metadata.util';

/**
 * Pre-configured imageMetadataGetter using Sharp.
 * Used in Zalo constructor: new Zalo({ imageMetadataGetter })
 */
export const imageMetadataGetter = createSharpImageMetadataGetter();
export * from './zca-metadata.util';

type FetchFunction = typeof globalThis.fetch;

/**
 * Creates a fetch polyfill function compatible with zca-js.
 * Crucially, ensures `response.headers.getSetCookie()` exists so that multi-cookie
 * Set-Cookie headers with commas (such as Expires=Wed, 14-Oct-2026...) are NOT split
 * incorrectly by fallback .split(", "), preserving critical session cookies during QR login.
 */
export function createFetchPolyfill(agent?: unknown): FetchFunction {
  if (agent) {
    const customFetch: FetchFunction = async (input, init) => {
      const res = (await (nodefetch as unknown as FetchFunction)(
        input,
        init,
      )) as unknown as globalThis.Response & {
        headers: globalThis.Headers & {
          raw?: () => Record<string, string[]>;
          getSetCookie?: () => string[];
        };
      };
      if (typeof res.headers.getSetCookie !== 'function' && typeof res.headers.raw === 'function') {
        const rawHeaders = res.headers.raw.bind(res.headers);
        res.headers.getSetCookie = () => rawHeaders()['set-cookie'] || [];
      }
      return res;
    };
    return customFetch;
  }
  return globalThis.fetch;
}

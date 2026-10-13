/**
 * ZCA Auth & Session Shape definitions
 * Reference: https://zca-js.tdung.com/vi/auth/
 * Covers authentication options (Cookie, QR Code, Proxy, Multi-account credentials)
 */

export type {
  Cookie,
  Credentials,
  LoginQRCallback,
  LoginQRCallbackEvent,
  Options as ZcaClientOptions,
  ContextSession,
  ContextBase,
  AppContextExtended,
  AppContextBase,
  ZPWServiceMap,
  ImageMetadataGetter,
  ImageMetadataGetterResponse,
} from 'zca-js';

export { LoginQRCallbackEventType, Zalo, API } from 'zca-js';

/**
 * Parameters for loginQR
 */
export interface ZcaLoginQROptions {
  userAgent?: string;
  language?: string;
  qrPath?: string;
}

import { Zalo, type API, type ImageMetadataGetter, GroupEventType, ThreadType } from 'zca-js';
import { HttpProxyAgent } from 'http-proxy-agent';
import nodefetch from 'node-fetch';
import { createSharpImageMetadataGetter } from './zca-metadata.util';
import { createFetchPolyfill } from './utils';
import {
  WelcomeGroupEventStrategy,
  type WelcomeStrategyOptions,
} from './strategies/welcome-group-event.strategy';

export { Zalo, type API, HttpProxyAgent, nodefetch, GroupEventType, ThreadType };
export * from './shapes';
export * from './zca.constants';
export * from './zca.interfaces';
export * from './zca-metadata.util';
export * from './utils';
export * from './strategies/group-event.strategy.interface';
export * from './strategies/welcome-group-event.strategy';
export * from './group-event-dispatcher.service';
export * from './zca.service';
export * from './zca.module';
export * from './confirmation/transaction-confirmation.service';
export * from './confirmation/dto-descriptor.util';
export * from './guards/initial-admin-bootstrap.guard';
export * from './guards/grant-access.guard';
export * from './pending-image/pending-image-action.service';
export * from './pending-image/pending-image.interface';
export * from './pending-image/pending-image-dispatcher.service';
export * from './pending-image/image-batch-handler.service';

export interface CreateZcaClientOptions {
  proxyUrl?: string;
  selfListen?: boolean;
  checkUpdate?: boolean;
  logging?: boolean;
  enableSharpMetadata?: boolean;
  imageMetadataGetter?: ImageMetadataGetter;
}

/**
 * Helper to instantiate Zalo with proxy agent and node-fetch polyfill:
 * ```ts
 * const zalo = createZcaClient({
 *   proxyUrl: 'http(s)://user:pass@host:port',
 * });
 * ```
 */
export function createZcaClient(options?: CreateZcaClientOptions): Zalo {
  const agent = options?.proxyUrl ? new HttpProxyAgent(options.proxyUrl) : undefined;

  let imageMetadataGetter = options?.imageMetadataGetter;
  if (!imageMetadataGetter && options?.enableSharpMetadata) {
    imageMetadataGetter = createSharpImageMetadataGetter();
  }

  return new Zalo({
    agent,
    polyfill: createFetchPolyfill(agent),
    selfListen: options?.selfListen,
    checkUpdate: options?.checkUpdate,
    logging: options?.logging,
    imageMetadataGetter,
  });
}

/**
 * Attaches the Welcome strategy to an active ZCA API instance listener:
 * ```ts
 * const api = await zalo.loginQR();
 * initWelcome(api, { imagePath: './welcome.jpg' });
 * api.listener.start();
 * ```
 */
export function initWelcome(api: API, options?: WelcomeStrategyOptions): WelcomeGroupEventStrategy {
  const strategy = new WelcomeGroupEventStrategy(undefined, options);
  api.listener.on('group_event', (event) => {
    if (strategy.canHandle(event)) {
      void strategy.handle(event, api).catch((err: unknown) => {
        const errMsg =
          err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
        console.error('Welcome strategy error:', errMsg);
      });
    }
  });
  return strategy;
}

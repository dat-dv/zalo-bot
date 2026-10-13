import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { ZcaService } from './zca.service';
import { createZcaClient } from './index';
import type { ZcaPlugin } from './zca.interfaces';
import type { Message, Reaction, GroupEvent, FriendEvent } from 'zca-js';

void test('ZcaService initializes Zalo with proxy and node-fetch polyfill', () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'zca.proxyUrl') return 'http://user:pass@127.0.0.1:8888';
      return undefined;
    },
  } as unknown as ConfigService;

  const service = new ZcaService(mockConfigService);
  const client = service.getClient();

  assert.ok(client, 'Zalo client should be initialized');
  assert.strictEqual(service.isLoggedIn(), false);
  assert.strictEqual(service.getApi(), null);
});

void test('ZcaService initializes Zalo without proxy when not configured', () => {
  const mockConfigService = {
    get: (_key: string): undefined => undefined,
  } as unknown as ConfigService;

  const service = new ZcaService(mockConfigService);
  const client = service.getClient();

  assert.ok(client, 'Zalo client should be initialized');
});

void test('createZcaClient helper creates Zalo instance with custom proxy and nodefetch', () => {
  const client = createZcaClient({
    proxyUrl: 'http://proxy.local:3128',
    selfListen: false,
    checkUpdate: false,
    logging: false,
  });

  assert.ok(client, 'createZcaClient should return a Zalo instance');
});

void test('ZcaService registers plugins and supports plugin lifecycles', async () => {
  const mockConfigService = {
    get: (_key: string): undefined => undefined,
  } as unknown as ConfigService;

  const service = new ZcaService(mockConfigService);

  let messageHandled = false;
  let reactionHandled = false;
  let groupEventHandled = false;
  let friendEventHandled = false;
  let destroyed = false;

  const testPlugin: ZcaPlugin = {
    name: 'test-plugin',
    onMessage: (msg) => {
      if (msg) messageHandled = true;
    },
    onReaction: (rxn) => {
      if (rxn) reactionHandled = true;
    },
    onGroupEvent: (ev) => {
      if (ev) groupEventHandled = true;
    },
    onFriendEvent: (ev) => {
      if (ev) friendEventHandled = true;
    },
    onDestroy: () => {
      destroyed = true;
    },
  };

  service.registerPlugin(testPlugin);
  assert.strictEqual(service.getPlugins().length, 1);
  assert.strictEqual(service.getPlugins()[0].name, 'test-plugin');

  // Manually attach mock API to test dispatching
  (service as unknown as { api: Record<string, unknown> }).api = {};

  await service.dispatchMessage({ msgId: '123' } as unknown as Message);
  assert.strictEqual(messageHandled, true);

  await service.dispatchReaction({ rType: 1 } as unknown as Reaction);
  assert.strictEqual(reactionHandled, true);

  await service.dispatchGroupEvent({ group: 'g1' } as unknown as GroupEvent);
  assert.strictEqual(groupEventHandled, true);

  await service.dispatchFriendEvent({ uid: 'u1' } as unknown as FriendEvent);
  assert.strictEqual(friendEventHandled, true);

  await service.onModuleDestroy();
  assert.strictEqual(destroyed, true);
});

void test('ZcaService gracefully catches errors in plugins without affecting other plugins', async () => {
  const mockConfigService = {
    get: (_key: string): undefined => undefined,
  } as unknown as ConfigService;

  const service = new ZcaService(mockConfigService);

  let secondPluginRan = false;

  const throwingPlugin: ZcaPlugin = {
    name: 'failing-plugin',
    onMessage: () => {
      throw new Error('Boom');
    },
  };

  const succeedingPlugin: ZcaPlugin = {
    name: 'succeeding-plugin',
    onMessage: () => {
      secondPluginRan = true;
    },
  };

  service.registerPlugins([throwingPlugin, succeedingPlugin]);

  // Attach mock API
  (service as unknown as { api: Record<string, unknown> }).api = {};

  await service.dispatchMessage({ msgId: '456' } as unknown as Message);
  assert.strictEqual(secondPluginRan, true, 'Second plugin should run even if first plugin throws');
});

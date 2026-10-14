import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { ZcaService } from './zca.service';
import { createZcaClient } from './index';
import type { ZcaPlugin } from './zca.interfaces';
import type { Message, Reaction, GroupEvent, FriendEvent } from 'zca-js';
import type { RedisService } from '../redis/redis.service';

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

void test('ZcaService startListener registers on message listener and filters threads correctly', async () => {
  const mockConfigService = {
    get: (_key: string): undefined => undefined,
  } as unknown as ConfigService;

  const service = new ZcaService(mockConfigService);
  const registeredListeners: Record<string, (arg: unknown) => void> = {};

  const mockListener = {
    on: (event: string, cb: (arg: unknown) => void) => {
      registeredListeners[event] = cb;
    },
    start: () => {},
    stop: () => {},
  };

  (service as unknown as { api: { listener: typeof mockListener } }).api = {
    listener: mockListener,
  };

  let dispatchedMessage: Message | null = null;
  const testPlugin: ZcaPlugin = {
    name: 'test-listener-plugin',
    onMessage: (msg) => {
      dispatchedMessage = msg;
    },
  };
  service.registerPlugin(testPlugin);

  await service.setListenedThreadIds(['allowed-thread-101']);
  service.startListener();

  assert.ok(registeredListeners['message'], 'message listener should be registered');

  // Ignored message (thread not in listened list)
  registeredListeners['message']({
    threadId: 'thread-999',
    type: 0,
    isSelf: false,
    data: { content: 'hello from ignored thread', dName: 'User B', uidFrom: 'u2' },
  });
  assert.strictEqual(dispatchedMessage, null, 'Ignored thread message should not be dispatched');

  // Allowed message (thread in listened list)
  const allowedMsg = {
    threadId: 'allowed-thread-101',
    type: 1,
    isSelf: false,
    data: { content: 'hello from allowed thread', dName: 'User A', uidFrom: 'u1' },
  } as unknown as Message;
  registeredListeners['message'](allowedMsg);
  assert.strictEqual(dispatchedMessage, allowedMsg, 'Allowed thread message should be dispatched');
});

interface ServiceInternals {
  saveSessionToFile(session: { imei: string; cookie: unknown; userAgent: string }): Promise<void>;
  loadSavedSession(): Promise<{ imei: string; cookie: unknown; userAgent: string } | null>;
}

void test('ZcaService loads and saves session to configured dataDir and syncs to Redis', async () => {
  const tmpDir = path.resolve(os.tmpdir(), `zca-test-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  let redisKey = '';
  let redisVal = '';
  const mockRedisService = {
    isReady: true,
    get: (key: string): Promise<string | null> =>
      Promise.resolve(key === 'zca:session' ? redisVal || null : null),
    set: (key: string, val: string): Promise<boolean> => {
      redisKey = key;
      redisVal = val;
      return Promise.resolve(true);
    },
  } as unknown as RedisService;

  const mockConfigService = {
    get: (key: string) => {
      if (key === 'DATA_DIR') return tmpDir;
      return undefined;
    },
  } as unknown as ConfigService;

  const service = new ZcaService(
    mockConfigService,
    { dataDir: tmpDir },
    undefined,
    undefined,
    undefined,
    mockRedisService,
  );

  const internals = service as unknown as ServiceInternals;

  // Save session
  const testSession = {
    imei: 'test-imei-123',
    cookie: { zpw_sek: 'secret-cookie' },
    userAgent: 'test-agent',
  };
  await internals.saveSessionToFile(testSession);

  // Verify file in tmpDir
  const savedFilePath = path.resolve(tmpDir, '.zca-session.json');
  assert.strictEqual(fs.existsSync(savedFilePath), true, 'Session file should exist in dataDir');
  const fileContent = JSON.parse(fs.readFileSync(savedFilePath, 'utf8')) as { imei?: string };
  assert.strictEqual(fileContent.imei, 'test-imei-123');

  // Verify synced to Redis
  assert.strictEqual(redisKey, 'zca:session');
  assert.strictEqual((JSON.parse(redisVal) as { imei?: string }).imei, 'test-imei-123');

  // Verify loadSessionFromFile
  const loadedFromFile = service.loadSessionFromFile();
  assert.ok(loadedFromFile);
  assert.strictEqual(loadedFromFile.imei, 'test-imei-123');

  // Clean up
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

void test('ZcaService falls back to Redis when session file is missing', async () => {
  const tmpDir = path.resolve(os.tmpdir(), `zca-test-redis-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const mockRedisService = {
    isReady: true,
    get: (key: string): Promise<string | null> => {
      if (key === 'zca:session') {
        return Promise.resolve(
          JSON.stringify({
            imei: 'redis-imei-456',
            cookie: { zpw_sek: 'redis-cookie' },
            userAgent: 'redis-agent',
          }),
        );
      }
      return Promise.resolve(null);
    },
    set: (): Promise<boolean> => Promise.resolve(true),
  } as unknown as RedisService;

  const mockConfigService = {
    get: (key: string) => {
      if (key === 'DATA_DIR') return tmpDir;
      return undefined;
    },
  } as unknown as ConfigService;

  const service = new ZcaService(
    mockConfigService,
    { dataDir: tmpDir },
    undefined,
    undefined,
    undefined,
    mockRedisService,
  );

  service.loadSessionFromFile = () => null;

  const internals = service as unknown as ServiceInternals;
  const recovered = await internals.loadSavedSession();
  assert.ok(recovered);
  assert.strictEqual(recovered.imei, 'redis-imei-456');

  // Check that it also restored the file in tmpDir
  const restoredFile = path.resolve(tmpDir, '.zca-session.json');
  assert.strictEqual(fs.existsSync(restoredFile), true);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

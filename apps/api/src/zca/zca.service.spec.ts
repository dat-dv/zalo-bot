import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { ZcaService } from './zca.service';
import { createZcaClient } from './index';
import type { ZcaPlugin } from './zca.interfaces';
import { LoginQRCallbackEventType } from 'zca-js';
import type { Message, Reaction, GroupEvent, FriendEvent } from 'zca-js';
import type { RedisService } from '../redis/redis.service';
import { ThreadConfigService } from './thread-config.service';

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

void test('ZcaService logout stops listener, purges session files, deletes redis key, and resets state', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zca-test-logout-'));
  const sessionFile = path.resolve(tmpDir, '.zca-session.json');
  fs.writeFileSync(sessionFile, JSON.stringify({ imei: '123', cookie: {} }), 'utf-8');

  let deletedRedisKey: string | null = null;
  const mockRedisService = {
    get: async (): Promise<null> => {
      await Promise.resolve();
      return null;
    },
    set: async () => {},
    del: async (key: string) => {
      await Promise.resolve();
      deletedRedisKey = key;
    },
  } as unknown as RedisService;

  const mockConfigService = {
    get: (): undefined => undefined,
  } as unknown as ConfigService;

  const service = new ZcaService(
    mockConfigService,
    { dataDir: tmpDir },
    undefined,
    undefined,
    undefined,
    mockRedisService,
  );

  let listenerStopped = false;
  // Attach fake api & listener
  (service as unknown as { api: { listener: { stop: () => void } } }).api = {
    listener: {
      stop: () => {
        listenerStopped = true;
      },
    },
  };
  (service as unknown as { isListening: boolean }).isListening = true;

  assert.strictEqual(service.isLoggedIn(), true);
  assert.strictEqual(fs.existsSync(sessionFile), true);

  const result = await service.logout();
  assert.strictEqual(result.success, true);
  assert.strictEqual(listenerStopped, true);
  assert.strictEqual(service.isLoggedIn(), false);
  assert.strictEqual(service.getApi(), null);
  assert.strictEqual(fs.existsSync(sessionFile), false);
  assert.strictEqual(deletedRedisKey, 'zca:session');

  // Idempotence test: calling logout again when already logged out should not throw
  const secondResult = await service.logout();
  assert.strictEqual(secondResult.success, true);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

void test('ZcaService.getAvailableThreads returns empty array when not logged in', async () => {
  const mockConfigService = {
    get: (): undefined => undefined,
  } as unknown as ConfigService;

  const service = new ZcaService(mockConfigService);
  await service.setListenedThreadIds(['thread-123']);

  assert.strictEqual(service.isLoggedIn(), false);
  const threads = await service.getAvailableThreads();
  assert.deepStrictEqual(threads, []);
});

void test('ZcaService startListener ignores messages and group events when listenedThreadIds is empty (strict whitelist)', async () => {
  const mockConfigService = {
    get: (): undefined => undefined,
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
  let dispatchedGroupEvent: GroupEvent | null = null;
  const testPlugin: ZcaPlugin = {
    name: 'strict-whitelist-plugin',
    onMessage: (msg) => {
      dispatchedMessage = msg;
    },
    onGroupEvent: (ev) => {
      dispatchedGroupEvent = ev;
    },
  };
  service.registerPlugin(testPlugin);

  // Start listener with 0 listened threads (strict whitelist / default deny)
  service.startListener();

  // 1. Message should be ignored
  registeredListeners['message']({
    threadId: 'group-100',
    type: 1,
    isSelf: false,
    data: { content: 'hello to unlistened group', dName: 'User A', uidFrom: 'u1' },
  });
  assert.strictEqual(
    dispatchedMessage,
    null,
    'Message must be ignored when listened list is empty',
  );

  // 2. Group event should be ignored
  registeredListeners['group_event']({
    threadId: 'group-100',
    type: 1,
    act: 'join',
    data: { updateMembers: ['u1'] },
  });
  assert.strictEqual(
    dispatchedGroupEvent,
    null,
    'Group event must be ignored when listened list is empty',
  );

  // 3. Now allow group-100
  await service.setListenedThreadIds(['group-100']);

  const allowedMsg = {
    threadId: 'group-100',
    type: 1,
    isSelf: false,
    data: { content: 'hello to allowed group', dName: 'User A', uidFrom: 'u1' },
  } as unknown as Message;
  registeredListeners['message'](allowedMsg);
  assert.strictEqual(
    dispatchedMessage,
    allowedMsg,
    'Message must be dispatched when thread is listened',
  );

  const allowedGroupEvent = {
    threadId: 'group-100',
    type: 1,
    act: 'join',
    data: { updateMembers: ['u1'] },
  } as unknown as GroupEvent;
  registeredListeners['group_event'](allowedGroupEvent);
  await new Promise((r) => setTimeout(r, 10));
  assert.strictEqual(
    dispatchedGroupEvent,
    allowedGroupEvent,
    'Group event must be dispatched when thread is listened',
  );
});

void test('ZcaService setListenedThreadIds unlistens removed threads in ThreadConfigService', async () => {
  const statusMap = new Map<string, boolean>();
  const mockThreadConfigService = {
    loadConfigs: async () => {},
    getListenedThreadIds: () =>
      Array.from(statusMap.entries())
        .filter(([, v]) => v)
        .map(([k]) => k),
    setListened: async (threadId: string, isListened: boolean) => {
      statusMap.set(threadId, isListened);
    },
  } as unknown as ThreadConfigService;

  const mockConfigService = {
    get: (): undefined => undefined,
  } as unknown as ConfigService;

  const service = new ZcaService(
    mockConfigService,
    undefined,
    undefined,
    undefined,
    mockThreadConfigService,
  );

  // Listen to threads A and B
  await service.setListenedThreadIds(['thread-A', 'thread-B']);
  assert.strictEqual(statusMap.get('thread-A'), true);
  assert.strictEqual(statusMap.get('thread-B'), true);
  assert.deepStrictEqual(service.getListenedThreadIds(), ['thread-A', 'thread-B']);

  // Now update to only listen to thread-B (thread-A is removed)
  await service.setListenedThreadIds(['thread-B']);
  assert.strictEqual(
    statusMap.get('thread-A'),
    false,
    'thread-A must be unlistened in ThreadConfigService',
  );
  assert.strictEqual(statusMap.get('thread-B'), true, 'thread-B must remain listened');
  assert.deepStrictEqual(service.getListenedThreadIds(), ['thread-B']);
});

void test('ZcaService passes ZCA-confirmed group type to thread configs and reconciles wrong ones', async () => {
  const mockConfigService = {
    get: (): undefined => undefined,
  } as unknown as ConfigService;
  const threadConfigService = new ThreadConfigService();
  const storedWrongGroupId = '7120342145544273834';
  const newGroupId = '7120342145544273835';
  await threadConfigService.updateConfig(storedWrongGroupId, { threadType: 'user' });

  const service = new ZcaService(
    mockConfigService,
    undefined,
    undefined,
    undefined,
    threadConfigService,
  );
  (service as unknown as { api: Record<string, unknown> }).api = {
    getAllGroups: () => Promise.resolve([{ groupId: storedWrongGroupId }, { groupId: newGroupId }]),
    getGroupInfo: () => Promise.resolve({ gridInfoMap: {} }),
  };

  await service.getAvailableThreads(true);
  // Reconciliation runs in the background so the thread list response is not delayed.
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual(threadConfigService.getConfigSync(storedWrongGroupId)?.threadType, 'group');

  await service.toggleListenedThread(newGroupId);
  assert.strictEqual(threadConfigService.getConfigSync(newGroupId)?.threadType, 'group');
  assert.strictEqual(await threadConfigService.isGroupThread(newGroupId), true);
});

void test('ZcaService issues a per-flow QR access key and revokes it when the flow ends', async () => {
  const mockConfigService = {
    get: (key: string): string | undefined =>
      key === 'appUrl' ? 'https://bot.example.com/' : undefined,
  } as unknown as ConfigService;
  const service = new ZcaService(mockConfigService);
  const client = service.getClient();
  let urlDuringFlow = '';
  let keyValidDuringFlow = false;
  client.loginQR = (_options, callback) => {
    callback?.({
      type: LoginQRCallbackEventType.QRCodeGenerated,
      data: {
        code: 'qr-payload',
        image: 'data:image/png;base64,AA==',
        options: { enabledCheckOCR: false, enabledMultiLayer: false },
        token: 't',
      },
      actions: {
        saveToFile: () => Promise.resolve(),
        retry: () => undefined,
        abort: () => undefined,
      },
    });
    urlDuringFlow = service.getQrImageUrl();
    keyValidDuringFlow = service.isQrAccessKeyValid(
      new URL(urlDuringFlow).searchParams.get('key') ?? undefined,
    );
    return Promise.reject(new Error('stop flow'));
  };

  assert.strictEqual(service.getQrImageUrl(), 'https://bot.example.com/api/zca/qr');
  await assert.rejects(() => service.startQrLogin(), /stop flow/);

  const key = new URL(urlDuringFlow).searchParams.get('key') ?? '';
  assert.ok(key.length >= 32, 'QR URL must carry an access key while the flow is active');
  assert.strictEqual(keyValidDuringFlow, true);
  // The flow failed, so its key no longer unlocks the image.
  assert.strictEqual(service.isQrAccessKeyValid(key), false);
  assert.strictEqual(service.isQrAccessKeyValid(undefined), false);
  assert.strictEqual(service.getQrImageUrl(), 'https://bot.example.com/api/zca/qr');
});

async function runBootstrap(options: {
  configured: Record<string, string>;
  savedSession: { imei: string; cookie: unknown; userAgent: string } | null;
}): Promise<number> {
  const mockConfigService = {
    get: (key: string): string | undefined => options.configured[key],
  } as unknown as ConfigService;
  const service = new ZcaService(mockConfigService, { dataDir: os.tmpdir() });
  const internals = service as unknown as ServiceInternals;
  internals.loadSavedSession = () => Promise.resolve(options.savedSession);
  let loginCalls = 0;
  service.login = () => {
    loginCalls += 1;
    return Promise.reject(new Error('stubbed login'));
  };
  await service.onApplicationBootstrap();
  return loginCalls;
}

void test('ZcaService bootstrap restores a saved session without any flag', async () => {
  const calls = await runBootstrap({
    configured: {},
    savedSession: { imei: 'saved-imei', cookie: [], userAgent: 'ua' },
  });
  assert.strictEqual(calls, 1);
});

void test('ZcaService bootstrap logs in with configured IMEI and cookie', async () => {
  const calls = await runBootstrap({
    configured: { 'zca.imei': 'env-imei', 'zca.cookie': '[]' },
    savedSession: null,
  });
  assert.strictEqual(calls, 1);
});

void test('ZcaService bootstrap skips login when there is no session or credential', async () => {
  const imei = process.env.ZCA_IMEI;
  const cookie = process.env.ZCA_COOKIE;
  delete process.env.ZCA_IMEI;
  delete process.env.ZCA_COOKIE;
  try {
    const calls = await runBootstrap({ configured: {}, savedSession: null });
    assert.strictEqual(calls, 0);
  } finally {
    if (imei !== undefined) process.env.ZCA_IMEI = imei;
    if (cookie !== undefined) process.env.ZCA_COOKIE = cookie;
  }
});

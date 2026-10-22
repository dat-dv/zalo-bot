import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { ZcaController } from './zca.controller';
import type { ZcaService } from './zca.service';
import type { ThreadConfigService } from './thread-config.service';
import type { Request, Response } from 'express';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ReportsTokenService } from '../reports/reports-token.service';
import type { UsersService } from '../users/users.service';
import type { MediaStorageService } from '../receipt-storage/media-storage.service';
import type { ChannelStorageLinkService } from './storage/channel-storage-link.service';
import type { ChannelStorageLinkEntity } from '../database/entities/channel-storage-link.entity';

const ADMIN_ID = 'admin-1';
const tokens = {
  verifyAccessToken: (token: string) => {
    if (token === 'admin-token') return ADMIN_ID;
    if (token === 'user-token') return 'user-2';
    throw new UnauthorizedException();
  },
  verifyRefreshToken: (token: string) => {
    if (token !== 'admin-refresh') throw new UnauthorizedException();
    return ADMIN_ID;
  },
} as unknown as ReportsTokenService;
const users = {
  isAdmin: (id: string | number) => String(id) === ADMIN_ID,
} as unknown as UsersService;

function bearer(token?: string): Request {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    cookies: {},
  } as unknown as Request;
}

void test('ZcaController.logout calls zcaService.logout and wraps in data envelope', async () => {
  let logoutCalled = false;
  const mockZcaService = {
    logout: async () => {
      await Promise.resolve();
      logoutCalled = true;
      return {
        success: true,
        message: 'Đã đăng xuất tài khoản ZCA và xóa phiên làm việc thành công.',
      };
    },
  } as unknown as ZcaService;

  const mockThreadConfigService = {} as unknown as ThreadConfigService;

  const controller = new ZcaController(mockZcaService, mockThreadConfigService, tokens, users);
  const result = await controller.logout(bearer('admin-token'));

  assert.strictEqual(logoutCalled, true);
  assert.deepStrictEqual(result, {
    data: {
      success: true,
      message: 'Đã đăng xuất tài khoản ZCA và xóa phiên làm việc thành công.',
    },
  });
});

void test('ZcaController.syncThreadMedia delegates to botFeatureService and wraps response', async () => {
  let capturedThreadId = '';
  let capturedBody: unknown;

  const mockBotFeatureService = {
    syncThreadMediaHistory: (threadId: string, body?: unknown) => {
      capturedThreadId = threadId;
      capturedBody = body;
      return Promise.resolve({
        threadId,
        scannedCount: 20,
        foundCount: 5,
        syncedCount: 5,
        skippedCount: 0,
        failedCount: 0,
        message: 'Thành công',
      });
    },
  } as unknown as import('./zca-bot-feature.service').ZcaBotFeatureService;

  const controller = new ZcaController(
    {} as unknown as ZcaService,
    {} as unknown as ThreadConfigService,
    tokens,
    users,
    mockBotFeatureService,
  );

  const res = await controller.syncThreadMedia(bearer('admin-token'), 'group-123', { limit: 100 });
  assert.strictEqual(capturedThreadId, 'group-123');
  assert.deepStrictEqual(capturedBody, { limit: 100 });
  assert.strictEqual(res.data.scannedCount, 20);
  assert.strictEqual(res.data.syncedCount, 5);
});

void test('ZcaController rejects missing tokens with 401 and non-admin users with 403', async () => {
  let logoutCalled = false;
  const zcaService = {
    logout: () => {
      logoutCalled = true;
      return Promise.resolve({ success: true, message: 'ok' });
    },
    isLoggedIn: () => true,
  } as unknown as ZcaService;
  const controller = new ZcaController(
    zcaService,
    {} as unknown as ThreadConfigService,
    tokens,
    users,
  );

  await assert.rejects(() => controller.logout(bearer()), UnauthorizedException);
  await assert.rejects(() => controller.logout(bearer('user-token')), ForbiddenException);
  assert.throws(() => controller.getStatus(bearer('user-token')), ForbiddenException);
  assert.strictEqual(logoutCalled, false);
});

void test('ZcaController.getQrImage serves the QR for a valid access key or admin refresh cookie only', () => {
  const zcaService = {
    isQrAccessKeyValid: (key?: string) => key === 'flow-key',
    getLatestQrBuffer: () => Buffer.from('png'),
  } as unknown as ZcaService;
  const controller = new ZcaController(
    zcaService,
    {} as unknown as ThreadConfigService,
    tokens,
    users,
  );
  let ended = 0;
  const res = {
    setHeader: (): void => undefined,
    end: () => {
      ended += 1;
    },
  } as unknown as Response;

  controller.getQrImage(bearer(), res, 'flow-key');
  const cookieReq = {
    headers: {},
    cookies: { reports_refresh: 'admin-refresh' },
  } as unknown as Request;
  controller.getQrImage(cookieReq, res);
  assert.strictEqual(ended, 2);

  assert.throws(() => controller.getQrImage(bearer(), res, 'wrong-key'), UnauthorizedException);
  assert.throws(() => controller.getQrImage(bearer('user-token'), res), ForbiddenException);
  assert.strictEqual(ended, 2);
});

void test('ZcaController.getThreadStorageLinks syncs the current storage then lists every link', async () => {
  const target = {
    channelId: 'g1',
    driveRoot: 'zalobot/g1',
    splitByCategory: true,
    photosAlbumTitle: '[Zalo] Nhà',
  };
  const mockThreadConfigService = {
    getStorageTarget: (threadId: string) => Promise.resolve({ ...target, channelId: threadId }),
  } as unknown as ThreadConfigService;
  const synced: string[] = [];
  const mediaStorage = {
    syncCurrentStorage: (t: { channelId: string }) => {
      synced.push(t.channelId);
      return Promise.resolve({ drive: { resourceId: 'root-new', url: 'u-new' } });
    },
  } as unknown as MediaStorageService;
  const linkService = {
    listForThread: () =>
      Promise.resolve([
        {
          id: '1',
          threadId: 'g1',
          kind: 'drive',
          googleEmail: 'old@gmail.com',
          resourceId: 'root-old',
          url: 'u-old',
          label: 'zalobot/g1',
          firstUsedAt: new Date('2026-01-01T00:00:00Z'),
          lastUsedAt: new Date('2026-09-01T00:00:00Z'),
        },
        {
          id: '2',
          threadId: 'g1',
          kind: 'drive',
          googleEmail: 'new@gmail.com',
          resourceId: 'root-new',
          url: 'u-new',
          label: 'zalobot/g1',
          firstUsedAt: new Date('2026-10-01T00:00:00Z'),
          lastUsedAt: new Date('2026-10-01T00:00:00Z'),
        },
      ]),
  } as unknown as ChannelStorageLinkService;
  const controller = new ZcaController(
    {} as unknown as ZcaService,
    mockThreadConfigService,
    tokens,
    users,
    undefined,
    mediaStorage,
    linkService,
  );

  await assert.rejects(
    () => controller.getThreadStorageLinks(bearer('user-token'), 'g1'),
    ForbiddenException,
  );

  const res = await controller.getThreadStorageLinks(bearer('admin-token'), 'g1');
  assert.deepEqual(synced, ['g1']);
  assert.deepEqual(
    res.data.drive.map((l) => [l.googleEmail, l.isCurrent]),
    [
      ['new@gmail.com', true],
      ['old@gmail.com', false],
    ],
  );
});

function storageLinkController(options: {
  rows: ChannelStorageLinkEntity[];
  current: { drive?: { resourceId: string; url: string } };
}) {
  const calls: { updated?: unknown; removed?: string[] } = {};
  const mockThreadConfigService = {
    getStorageTarget: (threadId: string) =>
      Promise.resolve({
        channelId: threadId,
        driveRoot: `zalobot/${threadId}`,
        splitByCategory: true,
        photosAlbumTitle: '[Zalo] Nhà',
      }),
  } as unknown as ThreadConfigService;
  const mediaStorage = {
    syncCurrentStorage: () => Promise.resolve(options.current),
  } as unknown as MediaStorageService;
  const linkService = {
    findLinkGroup: (threadId: string, linkId: string) =>
      Promise.resolve(options.rows.filter((r) => r.threadId === threadId && r.id === linkId)),
    updateLinkGroup: (_rows: unknown, update: unknown) => {
      calls.updated = update;
      return Promise.resolve();
    },
    removeLinkGroup: (rows: { id: string }[]) => {
      calls.removed = rows.map((r) => r.id);
      return Promise.resolve();
    },
    listForThread: () => Promise.resolve([]),
  } as unknown as ChannelStorageLinkService;
  const controller = new ZcaController(
    {} as unknown as ZcaService,
    mockThreadConfigService,
    tokens,
    users,
    undefined,
    mediaStorage,
    linkService,
  );
  return { controller, calls };
}

const storageRow = (id: string, resourceId: string): ChannelStorageLinkEntity => ({
  id,
  threadId: 'g1',
  kind: 'drive',
  resourceId,
  url: `https://drive.google.com/drive/folders/${resourceId}`,
  label: 'zalobot/g1',
  googleEmail: null,
  displayName: null,
  firstUsedAt: new Date('2026-01-01T00:00:00Z'),
  lastUsedAt: new Date('2026-01-01T00:00:00Z'),
});
const currentRoot = {
  drive: { resourceId: 'root-new', url: 'https://drive.google.com/drive/folders/root-new' },
};

void test('ZcaController storage link edit/delete are admin-only and 404 for another thread', async () => {
  const { controller } = storageLinkController({
    rows: [storageRow('old', 'root-old')],
    current: currentRoot,
  });

  await assert.rejects(
    () => controller.deleteThreadStorageLink(bearer('user-token'), 'g1', 'old'),
    ForbiddenException,
  );
  await assert.rejects(
    () => controller.updateThreadStorageLink(bearer('admin-token'), 'g2', 'old', {}),
    NotFoundException,
  );
});

void test('ZcaController edits a link with the validated values and rejects bad input', async () => {
  const { controller, calls } = storageLinkController({
    rows: [storageRow('old', 'root-old')],
    current: currentRoot,
  });

  await assert.rejects(
    () =>
      controller.updateThreadStorageLink(bearer('admin-token'), 'g1', 'old', {
        url: 'https://evil.example/x',
      }),
    BadRequestException,
  );

  await controller.updateThreadStorageLink(bearer('admin-token'), 'g1', 'old', {
    displayName: ' Kho cũ ',
    googleEmail: 'Old@Gmail.com',
  });
  assert.deepEqual(calls.updated, { displayName: 'Kho cũ', googleEmail: 'old@gmail.com' });
});

void test('ZcaController never deletes the link in use nor changes its URL', async () => {
  const { controller, calls } = storageLinkController({
    rows: [storageRow('cur', 'root-new'), storageRow('old', 'root-old')],
    current: currentRoot,
  });

  await assert.rejects(
    () => controller.deleteThreadStorageLink(bearer('admin-token'), 'g1', 'cur'),
    BadRequestException,
  );
  await assert.rejects(
    () =>
      controller.updateThreadStorageLink(bearer('admin-token'), 'g1', 'cur', {
        url: 'https://drive.google.com/drive/folders/other',
      }),
    BadRequestException,
  );
  // Name and email of the link in use stay editable.
  await controller.updateThreadStorageLink(bearer('admin-token'), 'g1', 'cur', {
    displayName: 'Kho mới',
  });
  assert.deepEqual(calls.updated, { displayName: 'Kho mới' });

  await controller.deleteThreadStorageLink(bearer('admin-token'), 'g1', 'old');
  assert.deepEqual(calls.removed, ['old']);
});

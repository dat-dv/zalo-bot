import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { GoogleResourcesController } from './google-resources.controller';
import { GoogleAuthService } from './google-auth.service';
import { GoogleDriveService } from './google-drive.service';
import type { ChannelStorageLinkService } from '../zca/storage/channel-storage-link.service';
import { ReportsTokenService } from '../reports/reports-token.service';
import type { ThreadConfigService } from '../zca/thread-config.service';
import type { UsersService } from '../users/users.service';

const ADMIN_ID = 'admin-1';
const adminTokens = {
  verifyAccessToken: (token: string) => (token === 'valid-token' ? ADMIN_ID : 'user-2'),
  verifyRefreshToken: (token: string) => {
    if (token !== 'refresh-admin') throw new UnauthorizedException();
    return ADMIN_ID;
  },
} as unknown as ReportsTokenService;
const adminUsers = {
  isAdmin: (id: string | number) => String(id) === ADMIN_ID,
} as unknown as UsersService;

function createMockRequest(userId = 'test-user'): Request {
  return {
    headers: {
      authorization: `Bearer valid-token`,
    },
    user: {
      id: userId,
    },
  } as unknown as Request;
}

void test('GoogleResourcesController shareDrive throws BadRequestException when email is invalid', async () => {
  const controller = new GoogleResourcesController(
    adminTokens,
    {
      isSharedAuthorized: () => true,
      hasStorageScopes: () => true,
    } as unknown as GoogleAuthService,
    {} as unknown as GoogleDriveService,
    undefined,
    adminUsers,
  );

  await assert.rejects(async () => {
    await controller.shareDrive(createMockRequest(ADMIN_ID), {
      channelId: 'g-123',
      email: 'invalid-email',
    });
  }, /Email không hợp lệ/i);
});

void test('GoogleResourcesController shareDrive successfully shares channel folder', async () => {
  let sharedFolder = '';
  let sharedEmail = '';
  const mockDrive = {
    getFolderWebLink: () => Promise.resolve('https://drive.mock/zalobot/g-123'),
    shareFolderWithUser: (folder: string, email: string) => {
      sharedFolder = folder;
      sharedEmail = email;
      return Promise.resolve({
        fileId: 'f1',
        permissionId: 'p1',
        emailAddress: email,
        role: 'reader' as const,
      });
    },
  } as unknown as GoogleDriveService;

  const controller = new GoogleResourcesController(
    adminTokens,
    {
      isSharedAuthorized: () => true,
      hasStorageScopes: () => true,
    } as unknown as GoogleAuthService,
    mockDrive,
    undefined,
    adminUsers,
  );

  const res = await controller.shareDrive(createMockRequest(ADMIN_ID), {
    channelId: 'g-123',
    email: 'test@gmail.com',
  });
  assert.equal(res.success, true);
  assert.equal(sharedFolder, 'zalobot/g-123');
  assert.equal(sharedEmail, 'test@gmail.com');
  assert.equal(res.webViewLink, 'https://drive.mock/zalobot/g-123');
});

void test('GoogleResourcesController getDriveFolderLink returns root zalobot link when channelId is not provided', async () => {
  const mockDrive = {
    getFolderWebLink: (folder: string) => Promise.resolve(`https://drive.mock/${folder}`),
  } as unknown as GoogleDriveService;

  const controller = new GoogleResourcesController(
    adminTokens,
    {} as unknown as GoogleAuthService,
    mockDrive,
    undefined,
    adminUsers,
  );

  const res = await controller.getDriveFolderLink(createMockRequest(ADMIN_ID));
  assert.deepEqual(res, {
    data: {
      folderPath: 'zalobot',
      webViewLink: 'https://drive.mock/zalobot',
    },
  });
});

void test('GoogleResourcesController getDriveFolderLink returns channel folder link when channelId is provided', async () => {
  let savedThreadId = '';
  let savedInfo: unknown = null;
  const mockThreadConfigService = {
    saveDriveFolderInfo: (tId: string, info: unknown) => {
      savedThreadId = tId;
      savedInfo = info;
      return Promise.resolve();
    },
  } as unknown as ThreadConfigService;

  const mockDrive = {
    getFolderWebLink: (folder: string) => Promise.resolve(`https://drive.mock/${folder}`),
  } as unknown as GoogleDriveService;

  const controller = new GoogleResourcesController(
    adminTokens,
    {} as unknown as GoogleAuthService,
    mockDrive,
    undefined,
    adminUsers,
    mockThreadConfigService,
  );

  const res = await controller.getDriveFolderLink(createMockRequest(ADMIN_ID), 'g-team-channel');
  assert.deepEqual(res, {
    data: {
      folderPath: 'zalobot/g-team-channel',
      webViewLink: 'https://drive.mock/zalobot/g-team-channel',
    },
  });
  assert.equal(savedThreadId, 'g-team-channel');
  assert.ok(savedInfo);
});

void test('GoogleResourcesController getDriveFolderLink uses customFolder if configured in ThreadBotConfig', async () => {
  const mockThreadConfigService = {
    getConfigSync: (tId: string) => ({
      threadId: tId,
      mediaBackup: { customFolder: 'zalobot/CustomProject' },
    }),
    saveDriveFolderInfo: () => Promise.resolve(),
  } as unknown as ThreadConfigService;

  const mockDrive = {
    getFolderWebLink: (folder: string) => Promise.resolve(`https://drive.mock/${folder}`),
  } as unknown as GoogleDriveService;

  const controller = new GoogleResourcesController(
    adminTokens,
    {} as unknown as GoogleAuthService,
    mockDrive,
    undefined,
    adminUsers,
    mockThreadConfigService,
  );

  const res = await controller.getDriveFolderLink(createMockRequest(ADMIN_ID), 'g-custom-channel');
  assert.deepEqual(res, {
    data: {
      folderPath: 'zalobot/CustomProject',
      webViewLink: 'https://drive.mock/zalobot/CustomProject',
    },
  });
});

void test('GoogleResourcesController openDriveFolder redirects to channel folder link', async () => {
  const mockDrive = {
    getFolderWebLink: (folder: string) => Promise.resolve(`https://drive.mock/${folder}`),
  } as unknown as GoogleDriveService;

  const controller = new GoogleResourcesController(
    adminTokens,
    {} as unknown as GoogleAuthService,
    mockDrive,
    undefined,
    adminUsers,
  );

  let redirectedUrl = '';
  const mockRes = {
    redirect: (url: string) => {
      redirectedUrl = url;
    },
  } as unknown as import('express').Response;

  await controller.openDriveFolder(createMockRequest(ADMIN_ID), mockRes, 'g-redirect-channel');
  assert.equal(redirectedUrl, 'https://drive.mock/zalobot/g-redirect-channel');
});

void test('GoogleResourcesController shareDrive stores numeric ZCA group folder on thread config only', async () => {
  const mockDrive = {
    getFolderWebLink: () => Promise.resolve('https://drive.mock/zalobot/7120342145544273834'),
    shareFolderWithUser: (_folder: string, email: string) =>
      Promise.resolve({ fileId: 'f1', permissionId: 'p1', emailAddress: email, role: 'reader' }),
  } as unknown as GoogleDriveService;

  const savedThreadIds: string[] = [];
  const savedUserIds: string[] = [];
  const mockThreadConfig = {
    isGroupThread: (id: string) => Promise.resolve(id === '7120342145544273834'),
    saveDriveFolderInfo: (id: string) => {
      savedThreadIds.push(id);
      return Promise.resolve();
    },
  } as unknown as ThreadConfigService;
  const mockUsers = {
    isAdmin: (id: string | number) => String(id) === ADMIN_ID,
    saveDriveFolderInfo: (id: string) => {
      savedUserIds.push(id);
      return Promise.resolve();
    },
  } as unknown as UsersService;

  const controller = new GoogleResourcesController(
    adminTokens,
    {
      isSharedAuthorized: () => true,
      hasStorageScopes: () => true,
    } as unknown as GoogleAuthService,
    mockDrive,
    undefined,
    mockUsers,
    mockThreadConfig,
  );

  await controller.shareDrive(createMockRequest(ADMIN_ID), {
    channelId: '7120342145544273834',
    email: 'test@gmail.com',
  });
  assert.deepEqual(savedThreadIds, ['7120342145544273834']);
  assert.deepEqual(savedUserIds, []);
});

void test('GoogleResourcesController shareDrive rejects requests without a dashboard token', async () => {
  const controller = new GoogleResourcesController(
    adminTokens,
    {} as unknown as GoogleAuthService,
    {} as unknown as GoogleDriveService,
    undefined,
    adminUsers,
  );
  const req = { headers: {} } as unknown as Request;
  await assert.rejects(
    () => controller.shareDrive(req, { channelId: 'g-123', email: 'test@gmail.com' }),
    UnauthorizedException,
  );
});

void test('GoogleResourcesController drive/photos link routes reject non-admin users', async () => {
  const controller = new GoogleResourcesController(
    adminTokens,
    {} as unknown as GoogleAuthService,
    {} as unknown as GoogleDriveService,
    undefined,
    adminUsers,
  );
  const userReq = {
    headers: { authorization: 'Bearer other-token' },
  } as unknown as Request;
  await assert.rejects(
    () => controller.shareDrive(userReq, { channelId: 'g-123', email: 'test@gmail.com' }),
    ForbiddenException,
  );
  await assert.rejects(() => controller.getDriveFolderLink(userReq, 'g-123'), ForbiddenException);
  await assert.rejects(() => controller.getPhotosAlbumLink(userReq, 'g-123'), ForbiddenException);
});

void test('GoogleResourcesController open routes accept the admin refresh cookie and reject anonymous calls', async () => {
  const controller = new GoogleResourcesController(
    adminTokens,
    {} as unknown as GoogleAuthService,
    {
      getFolderWebLink: (folder: string) => Promise.resolve(`https://drive.mock/${folder}`),
    } as unknown as GoogleDriveService,
    undefined,
    adminUsers,
  );
  let redirectedUrl = '';
  const mockRes = {
    redirect: (url: string) => {
      redirectedUrl = url;
    },
  } as unknown as import('express').Response;

  const cookieReq = {
    headers: {},
    cookies: { reports_refresh: 'refresh-admin' },
  } as unknown as Request;
  await controller.openDriveFolder(cookieReq, mockRes);
  assert.equal(redirectedUrl, 'https://drive.mock/zalobot');

  const anonymousReq = { headers: {}, cookies: {} } as unknown as Request;
  await assert.rejects(
    () => controller.openDriveFolder(anonymousReq, mockRes),
    UnauthorizedException,
  );
  await assert.rejects(
    () => controller.openPhotosAlbum(anonymousReq, mockRes),
    UnauthorizedException,
  );
});

void test('GoogleResourcesController getDriveFolderLink ignores a stored month sub-folder link', async () => {
  const mockThreadConfigService = {
    getConfigSync: (tId: string) => ({
      threadId: tId,
      mediaBackup: { customFolder: 'zalobot/team_dev' },
      driveFolderPath: 'zalobot/team_dev/2026-10',
      driveFolderUrl: 'https://drive.google.com/drive/folders/leaf',
    }),
    saveDriveFolderInfo: () => Promise.resolve(),
  } as unknown as ThreadConfigService;

  const mockDrive = {
    getFolderWebLink: (folder: string) => Promise.resolve(`https://drive.mock/${folder}`),
  } as unknown as GoogleDriveService;

  const controller = new GoogleResourcesController(
    adminTokens,
    {} as unknown as GoogleAuthService,
    mockDrive,
    undefined,
    adminUsers,
    mockThreadConfigService,
  );

  const res = await controller.getDriveFolderLink(createMockRequest(ADMIN_ID), '123');
  assert.deepEqual(res, {
    data: {
      folderPath: 'zalobot/team_dev',
      webViewLink: 'https://drive.mock/zalobot/team_dev',
    },
  });
});

const sharedEmailAuth = {
  getSharedAccountEmail: () => Promise.resolve('shared@gmail.com'),
} as unknown as GoogleAuthService;

/** History with one album row per `channel|email|title` key. */
function albumHistory(rows: Record<string, string>) {
  const lookups: string[] = [];
  const service = {
    findAlbum: (threadId: string, email: string, title: string) => {
      const key = `${threadId}|${email}|${title}`;
      lookups.push(key);
      const url = rows[key];
      return Promise.resolve(url ? { resourceId: 'album-id', url } : null);
    },
  } as unknown as ChannelStorageLinkService;
  return { service, lookups };
}

void test('GoogleResourcesController getPhotosAlbumLink reads the album of the current account, not a stale cached one', async () => {
  const mockThreadConfigService = {
    getConfigSync: (tId: string) => ({
      threadId: tId,
      threadName: 'Team Dev',
      mediaBackup: { photosAlbum: 'Album mới' },
      photosAlbumTitle: '[Zalo] Team Dev',
      photosAlbumUrl: 'https://photos.google.com/album/old',
    }),
  } as unknown as ThreadConfigService;
  const history = albumHistory({
    '123|shared@gmail.com|Album mới': 'https://photos.google.com/album/new',
  });

  const controller = new GoogleResourcesController(
    adminTokens,
    sharedEmailAuth,
    undefined,
    history.service,
    adminUsers,
    mockThreadConfigService,
  );

  const res = await controller.getPhotosAlbumLink(createMockRequest(ADMIN_ID), '123');
  assert.deepEqual(res, {
    data: { albumTitle: 'Album mới', webViewLink: 'https://photos.google.com/album/new' },
  });
  assert.deepEqual(history.lookups, ['123|shared@gmail.com|Album mới']);
});

void test('GoogleResourcesController getPhotosAlbumLink opens Google Photos when the channel has no album yet', async () => {
  const mockThreadConfigService = {
    getConfigSync: (tId: string) => ({
      threadId: tId,
      threadName: 'Team Dev',
      mediaBackup: {},
      photosAlbumTitle: '[Zalo] Team Dev',
      // Album of a previous Google account: never used.
      photosAlbumUrl: 'https://photos.google.com/album/old-account',
    }),
  } as unknown as ThreadConfigService;

  const controller = new GoogleResourcesController(
    adminTokens,
    sharedEmailAuth,
    undefined,
    albumHistory({}).service,
    adminUsers,
    mockThreadConfigService,
  );

  const res = await controller.getPhotosAlbumLink(createMockRequest(ADMIN_ID), '123');
  assert.deepEqual(res, {
    data: { albumTitle: '[Zalo] Team Dev', webViewLink: 'https://photos.google.com' },
  });
});

void test('GoogleResourcesController getPhotosAlbumLink without a channel opens Google Photos, there is no shared album', async () => {
  const history = albumHistory({});
  const controller = new GoogleResourcesController(
    adminTokens,
    sharedEmailAuth,
    undefined,
    history.service,
    adminUsers,
  );

  const res = await controller.getPhotosAlbumLink(createMockRequest(ADMIN_ID));
  assert.deepEqual(res, { data: { albumTitle: '', webViewLink: 'https://photos.google.com' } });
  assert.deepEqual(history.lookups, []);
});

void test('GoogleResourcesController openPhotosAlbum redirects to the recorded channel album', async () => {
  const controller = new GoogleResourcesController(
    adminTokens,
    sharedEmailAuth,
    undefined,
    albumHistory({ 'g-9|shared@gmail.com|[Zalo] Nhà': 'https://photos.app.goo.gl/nha' }).service,
    adminUsers,
  );
  let redirectedUrl = '';
  const mockRes = {
    redirect: (url: string) => {
      redirectedUrl = url;
    },
  } as unknown as import('express').Response;

  await controller.openPhotosAlbum(createMockRequest(ADMIN_ID), mockRes, 'g-9', 'Nhà');
  assert.equal(redirectedUrl, 'https://photos.app.goo.gl/nha');
});

function createStorageAccountAuth(state: { connected: boolean; scopes: boolean }) {
  const calls = { disconnect: 0, authUrlFor: [] as Array<string | number> };
  const auth = {
    isSharedAuthorized: () => state.connected,
    hasStorageScopes: () => state.scopes,
    getSharedAccountEmail: () => Promise.resolve(state.connected ? 'owner@gmail.com' : null),
    generateAuthUrl: (userId: string | number) => {
      calls.authUrlFor.push(userId);
      return `https://accounts.google.com/o/oauth2/auth?state=${userId}`;
    },
    disconnectSharedAccount: () => {
      calls.disconnect += 1;
      state.connected = false;
      return Promise.resolve();
    },
  } as unknown as GoogleAuthService;
  return { auth, calls };
}

void test('GoogleResourcesController storage account reports the shared Google account', async () => {
  const { auth } = createStorageAccountAuth({ connected: true, scopes: false });
  const controller = new GoogleResourcesController(
    adminTokens,
    auth,
    undefined,
    undefined,
    adminUsers,
  );

  const res = await controller.getStorageAccount(createMockRequest(ADMIN_ID));

  assert.deepEqual(res, {
    data: { connected: true, email: 'owner@gmail.com', hasStorageScopes: false },
  });
});

void test('GoogleResourcesController storage account login builds the auth URL for the admin', () => {
  const { auth, calls } = createStorageAccountAuth({ connected: false, scopes: false });
  const controller = new GoogleResourcesController(
    adminTokens,
    auth,
    undefined,
    undefined,
    adminUsers,
  );

  const res = controller.startStorageAccountLogin(createMockRequest(ADMIN_ID));

  assert.deepEqual(calls.authUrlFor, [ADMIN_ID]);
  assert.match(res.data.authUrl, /state=admin-1/);
});

void test('GoogleResourcesController storage account logout disconnects and returns the new status', async () => {
  const { auth, calls } = createStorageAccountAuth({ connected: true, scopes: true });
  const controller = new GoogleResourcesController(
    adminTokens,
    auth,
    undefined,
    undefined,
    adminUsers,
  );

  const res = await controller.logoutStorageAccount(createMockRequest(ADMIN_ID));

  assert.equal(calls.disconnect, 1);
  assert.deepEqual(res, { data: { connected: false, email: null, hasStorageScopes: false } });
});

void test('GoogleResourcesController storage account routes reject non-admin users', async () => {
  const { auth, calls } = createStorageAccountAuth({ connected: true, scopes: true });
  const controller = new GoogleResourcesController(
    adminTokens,
    auth,
    undefined,
    undefined,
    adminUsers,
  );
  const userReq = {
    headers: { authorization: 'Bearer other-token' },
  } as unknown as Request;

  await assert.rejects(() => controller.getStorageAccount(userReq), ForbiddenException);
  assert.throws(() => controller.startStorageAccountLogin(userReq), ForbiddenException);
  await assert.rejects(() => controller.logoutStorageAccount(userReq), ForbiddenException);
  assert.equal(calls.disconnect, 0);
  assert.deepEqual(calls.authUrlFor, []);
});

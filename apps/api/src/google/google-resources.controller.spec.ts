import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { GoogleResourcesController } from './google-resources.controller';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleTasksService } from './google-tasks.service';
import { GoogleAuthService } from './google-auth.service';
import { GoogleDriveService } from './google-drive.service';
import { ReportsTokenService } from '../reports/reports-token.service';
import type { ThreadConfigService } from '../zca/thread-config.service';

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

void test('GoogleResourcesController listTasks returns empty data array when user is not authorized', async () => {
  const mockTokens = {
    verifyAccessToken: () => 'user-123',
  } as unknown as ReportsTokenService;

  const mockAuthService = {
    isAuthorized: () => false,
  } as unknown as GoogleAuthService;

  const mockTasksService = {
    listTasks: () => Promise.reject(new Error('Should not be called')),
  } as unknown as GoogleTasksService;

  const controller = new GoogleResourcesController(
    {} as unknown as GoogleCalendarService,
    mockTasksService,
    mockTokens,
    mockAuthService,
  );

  const req = createMockRequest('user-123');
  const result = await controller.listTasks(req, {});

  assert.deepEqual(result, { data: [] });
});

void test('GoogleResourcesController listEvents returns empty data array when user is not authorized', async () => {
  const mockTokens = {
    verifyAccessToken: () => 'user-123',
  } as unknown as ReportsTokenService;

  const mockAuthService = {
    isAuthorized: () => false,
  } as unknown as GoogleAuthService;

  const mockCalendarService = {
    listEvents: () => Promise.reject(new Error('Should not be called')),
  } as unknown as GoogleCalendarService;

  const controller = new GoogleResourcesController(
    mockCalendarService,
    {} as unknown as GoogleTasksService,
    mockTokens,
    mockAuthService,
  );

  const req = createMockRequest('user-123');
  const result = await controller.listEvents(req, {});

  assert.deepEqual(result, { data: [] });
});

void test('GoogleResourcesController createTask throws BadRequestException when user is not authorized', async () => {
  const mockTokens = {
    verifyAccessToken: () => 'user-123',
  } as unknown as ReportsTokenService;

  const mockAuthService = {
    isAuthorized: () => false,
    getOAuth2Client: (): null => null,
  } as unknown as GoogleAuthService;

  const tasksService = new GoogleTasksService(mockAuthService);

  const controller = new GoogleResourcesController(
    {} as unknown as GoogleCalendarService,
    tasksService,
    mockTokens,
    mockAuthService,
  );

  const req = createMockRequest('user-123');

  await assert.rejects(
    async () => {
      await controller.createTask(req, { title: 'Test Task' });
    },
    (err: unknown) => {
      assert.ok(err instanceof BadRequestException);
      assert.match(err.message, /Tài khoản Google Tasks của bạn chưa được kết nối/);
      return true;
    },
  );
});

void test('GoogleResourcesController createEvent throws BadRequestException when user is not authorized', async () => {
  const mockTokens = {
    verifyAccessToken: () => 'user-123',
  } as unknown as ReportsTokenService;

  const mockAuthService = {
    isAuthorized: () => false,
    getOAuth2Client: (): null => null,
  } as unknown as GoogleAuthService;

  const calendarService = new GoogleCalendarService(mockAuthService, {
    getOrThrow: () => 'Asia/Ho_Chi_Minh',
  } as unknown as ConfigService);

  const controller = new GoogleResourcesController(
    calendarService,
    {} as unknown as GoogleTasksService,
    mockTokens,
    mockAuthService,
  );

  const req = createMockRequest('user-123');

  await assert.rejects(
    async () => {
      await controller.createEvent(req, {
        summary: 'Test Event',
        startDateTime: '2026-10-12T10:00:00Z',
        endDateTime: '2026-10-12T11:00:00Z',
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof BadRequestException);
      assert.match(err.message, /Tài khoản Google Calendar của bạn chưa được kết nối/);
      return true;
    },
  );
});

void test('GoogleResourcesController listEvents returns empty data when Google API throws auth error (invalid_grant)', async () => {
  let revokedUserId: string | number | null = null;
  const mockTokens = {
    verifyAccessToken: () => 'user-123',
  } as unknown as ReportsTokenService;

  const mockAuthService = {
    isAuthorized: () => true,
    handleAuthError: (userId: string | number, _err: unknown) => {
      revokedUserId = userId;
      return Promise.resolve(true);
    },
  } as unknown as GoogleAuthService;

  const mockCalendarService = {
    listEvents: () =>
      Promise.reject(new Error('invalid_grant: Token has been expired or revoked.')),
  } as unknown as GoogleCalendarService;

  const controller = new GoogleResourcesController(
    mockCalendarService,
    {} as unknown as GoogleTasksService,
    mockTokens,
    mockAuthService,
  );

  const req = createMockRequest('user-123');
  const result = await controller.listEvents(req, {
    timeMin: '2026-09-27T17:00:00.000Z',
    timeMax: '2026-11-01T17:00:00.000Z',
  });

  assert.deepEqual(result, { data: [] });
  assert.equal(revokedUserId, 'user-123');
});

void test('GoogleResourcesController listEvents returns empty data when Google API throws network or 403 error', async () => {
  const mockTokens = {
    verifyAccessToken: () => 'user-123',
  } as unknown as ReportsTokenService;

  const mockAuthService = {
    isAuthorized: () => true,
    handleAuthError: () => Promise.resolve(false),
  } as unknown as GoogleAuthService;

  const mockCalendarService = {
    listEvents: () => Promise.reject(new Error('Google Calendar API has not been used in project')),
  } as unknown as GoogleCalendarService;

  const controller = new GoogleResourcesController(
    mockCalendarService,
    {} as unknown as GoogleTasksService,
    mockTokens,
    mockAuthService,
  );

  const req = createMockRequest('user-123');
  const result = await controller.listEvents(req, {
    timeMin: '2026-09-27T17:00:00.000Z',
    timeMax: '2026-11-01T17:00:00.000Z',
  });

  assert.deepEqual(result, { data: [] });
});

void test('GoogleResourcesController listTasks returns empty data when Google Tasks API throws auth error', async () => {
  let revokedUserId: string | number | null = null;
  const mockTokens = {
    verifyAccessToken: () => 'user-123',
  } as unknown as ReportsTokenService;

  const mockAuthService = {
    isAuthorized: () => true,
    handleAuthError: (userId: string | number) => {
      revokedUserId = userId;
      return Promise.resolve(true);
    },
  } as unknown as GoogleAuthService;

  const mockTasksService = {
    listTasks: () => Promise.reject(new Error('invalid_token')),
  } as unknown as GoogleTasksService;

  const controller = new GoogleResourcesController(
    {} as unknown as GoogleCalendarService,
    mockTasksService,
    mockTokens,
    mockAuthService,
  );

  const req = createMockRequest('user-123');
  const result = await controller.listTasks(req, {});

  assert.deepEqual(result, { data: [] });
  assert.equal(revokedUserId, 'user-123');
});

void test('GoogleResourcesController shareDrive throws BadRequestException when email is invalid', async () => {
  const controller = new GoogleResourcesController(
    {} as unknown as GoogleCalendarService,
    {} as unknown as GoogleTasksService,
    {} as unknown as ReportsTokenService,
    {
      isSharedAuthorized: () => true,
      hasStorageScopes: () => true,
    } as unknown as GoogleAuthService,
    {} as unknown as GoogleDriveService,
  );

  await assert.rejects(async () => {
    await controller.shareDrive({ channelId: 'g-123', email: 'invalid-email' });
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
    {} as unknown as GoogleCalendarService,
    {} as unknown as GoogleTasksService,
    {} as unknown as ReportsTokenService,
    {
      isSharedAuthorized: () => true,
      hasStorageScopes: () => true,
    } as unknown as GoogleAuthService,
    mockDrive,
  );

  const res = await controller.shareDrive({ channelId: 'g-123', email: 'test@gmail.com' });
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
    {} as unknown as GoogleCalendarService,
    {} as unknown as GoogleTasksService,
    {} as unknown as ReportsTokenService,
    {} as unknown as GoogleAuthService,
    mockDrive,
  );

  const res = await controller.getDriveFolderLink();
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
    {} as unknown as GoogleCalendarService,
    {} as unknown as GoogleTasksService,
    {} as unknown as ReportsTokenService,
    {} as unknown as GoogleAuthService,
    mockDrive,
    undefined,
    mockThreadConfigService,
  );

  const res = await controller.getDriveFolderLink('g-team-channel');
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
    {} as unknown as GoogleCalendarService,
    {} as unknown as GoogleTasksService,
    {} as unknown as ReportsTokenService,
    {} as unknown as GoogleAuthService,
    mockDrive,
    undefined,
    mockThreadConfigService,
  );

  const res = await controller.getDriveFolderLink('g-custom-channel');
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
    {} as unknown as GoogleCalendarService,
    {} as unknown as GoogleTasksService,
    {} as unknown as ReportsTokenService,
    {} as unknown as GoogleAuthService,
    mockDrive,
  );

  let redirectedUrl = '';
  const mockRes = {
    redirect: (url: string) => {
      redirectedUrl = url;
    },
  } as unknown as import('express').Response;

  await controller.openDriveFolder(mockRes, 'g-redirect-channel');
  assert.equal(redirectedUrl, 'https://drive.mock/zalobot/g-redirect-channel');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { GoogleResourcesController } from './google-resources.controller';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleTasksService } from './google-tasks.service';
import { GoogleAuthService } from './google-auth.service';
import { ReportsTokenService } from '../reports/reports-token.service';

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
    listTasks: async () => {
      throw new Error('Should not be called');
    },
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
    listEvents: async () => {
      throw new Error('Should not be called');
    },
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
    getOAuth2Client: () => null,
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
    getOAuth2Client: () => null,
  } as unknown as GoogleAuthService;

  const calendarService = new GoogleCalendarService(mockAuthService, {
    getOrThrow: () => 'Asia/Ho_Chi_Minh',
  } as unknown as any);

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

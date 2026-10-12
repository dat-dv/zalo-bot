import assert from 'node:assert/strict';
import test from 'node:test';
import { LoginToolStrategy } from './login-tool.strategy';
import { CodeToolStrategy } from './code-tool.strategy';
import { StatusToolStrategy } from './status-tool.strategy';
import { ZaloService } from '../../zalo.service';
import { GoogleAuthService } from '../../../google/google-auth.service';
import { UsersService } from '../../../users/users.service';

void test('LoginToolStrategy blocks non-admin user and informs admin requirement', async () => {
  const sentMessages: string[] = [];
  const mockZaloService = {
    sendMessage: async (_chatId: string, text: string) => {
      await Promise.resolve();
      sentMessages.push(text);
      return true;
    },
  } as unknown as ZaloService;

  const mockUsersService = {
    isAdmin: (id: string) => id === 'admin_1',
  } as unknown as UsersService;

  const mockGoogleAuthService = {
    generateAuthUrl: () => 'https://accounts.google.com/o/oauth2/auth?...',
    isSharedAuthorized: () => false,
  } as unknown as GoogleAuthService;

  const strategy = new LoginToolStrategy(mockZaloService, mockGoogleAuthService, mockUsersService);

  // 1. Regular user
  await strategy.execute({
    chatId: 'c1',
    senderId: 'member_1',
    displayName: 'Member 1',
    text: '/login',
    input: {
      type: 'text',
      senderId: 'member_1',
      chatId: 'c1',
      displayName: 'Member 1',
    },
  });

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0], /Chỉ Quản trị viên \(Admin\) mới có quyền/);

  // 2. Admin user
  sentMessages.length = 0;
  await strategy.execute({
    chatId: 'c1',
    senderId: 'admin_1',
    displayName: 'Admin',
    text: '/login',
    input: {
      type: 'text',
      senderId: 'admin_1',
      chatId: 'c1',
      displayName: 'Admin',
    },
  });

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0], /KẾT NỐI TÀI KHOẢN GOOGLE HỆ THỐNG/);
  assert.match(sentMessages[0], /https:\/\/accounts\.google\.com/);
});

void test('CodeToolStrategy blocks non-admin and allows admin to exchange code', async () => {
  const sentMessages: string[] = [];
  const mockZaloService = {
    sendMessage: async (_chatId: string, text: string) => {
      await Promise.resolve();
      sentMessages.push(text);
      return true;
    },
  } as unknown as ZaloService;

  const mockUsersService = {
    isAdmin: (id: string) => id === 'admin_1',
  } as unknown as UsersService;

  let exchangedCode = '';
  const mockGoogleAuthService = {
    exchangeCodeForTokens: async (_userId: string, code: string) => {
      await Promise.resolve();
      exchangedCode = code;
    },
    getSharedAccountEmail: async () => {
      await Promise.resolve();
      return 'admin@gmail.com';
    },
  } as unknown as GoogleAuthService;

  const strategy = new CodeToolStrategy(mockZaloService, mockGoogleAuthService, mockUsersService);

  // 1. Non-admin
  await strategy.execute({
    chatId: 'c1',
    senderId: 'member_1',
    displayName: 'Member 1',
    text: '/code 4/mock-code',
    input: {
      type: 'text',
      senderId: 'member_1',
      chatId: 'c1',
      displayName: 'Member 1',
    },
  });

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0], /Chỉ Quản trị viên \(Admin\) mới có quyền/);
  assert.equal(exchangedCode, '');

  // 2. Admin
  sentMessages.length = 0;
  await strategy.execute({
    chatId: 'c1',
    senderId: 'admin_1',
    displayName: 'Admin',
    text: '/code 4/mock-code',
    input: {
      type: 'text',
      senderId: 'admin_1',
      chatId: 'c1',
      displayName: 'Admin',
    },
  });

  assert.equal(sentMessages.length, 1);
  assert.equal(exchangedCode, '4/mock-code');
  assert.match(sentMessages[0], /KẾT NỐI GOOGLE HỆ THỐNG THÀNH CÔNG/);
  assert.match(sentMessages[0], /admin@gmail\.com/);
  assert.match(sentMessages[0], /Google Drive/);
  assert.match(sentMessages[0], /Google Photos/);
});

void test('StatusToolStrategy displays shared workspace status properly', async () => {
  const sentMessages: string[] = [];
  const mockZaloService = {
    sendMessage: async (_chatId: string, text: string) => {
      await Promise.resolve();
      sentMessages.push(text);
      return true;
    },
  } as unknown as ZaloService;

  const mockUsersService = {
    isAdmin: (id: string) => id === 'admin_1',
  } as unknown as UsersService;

  const mockGoogleAuthService = {
    isSharedAuthorized: () => true,
    getSharedAccountEmail: async () => {
      await Promise.resolve();
      return 'shared-admin@gmail.com';
    },
  } as unknown as GoogleAuthService;

  const strategy = new StatusToolStrategy(mockZaloService, mockUsersService, mockGoogleAuthService);

  await strategy.execute({
    chatId: 'c1',
    senderId: 'member_2',
    displayName: 'Thành viên Test',
    text: '/status',
    input: {
      type: 'text',
      senderId: 'member_2',
      chatId: 'c1',
      displayName: 'Thành viên Test',
    },
  });

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0], /Thành viên \(Member\)/);
  assert.match(sentMessages[0], /GOOGLE WORKSPACE HỆ THỐNG/);
  assert.match(sentMessages[0], /Đã kết nối \(Dùng chung\)/);
  assert.match(sentMessages[0], /shared-admin@gmail\.com/);
  assert.match(sentMessages[0], /Google Drive/);
  assert.match(sentMessages[0], /Google Photos/);
});

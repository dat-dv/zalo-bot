import assert from 'node:assert/strict';
import test from 'node:test';
import { LoginToolStrategy } from './login-tool.strategy';
import { StatusToolStrategy } from './status-tool.strategy';
import { ZcaMessengerService } from '../../zca-messenger.service';
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
  } as unknown as ZcaMessengerService;

  const mockUsersService = {
    isAdmin: (id: string) => id === 'admin_1',
  } as unknown as UsersService;

  const mockGoogleAuthService = {
    generateAuthUrl: () => 'https://accounts.google.com/o/oauth2/auth?...',
    isSharedAuthorized: () => false,
    hasStorageScopes: () => true,
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
  assert.equal(
    sentMessages[0],
    '⛔ Chỉ admin mới kết nối được tài khoản Google dùng chung. Gõ /status để xem trạng thái.',
  );

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
  assert.match(sentMessages[0], /^🔐 Kết nối tài khoản Google dùng chung\n/);
  assert.match(sentMessages[0], /Hệ thống chưa kết nối tài khoản Google dùng chung\./);
  assert.match(sentMessages[0], /https:\/\/accounts\.google\.com/);
});

void test('StatusToolStrategy displays shared workspace status properly', async () => {
  const sentMessages: string[] = [];
  const mockZaloService = {
    sendMessage: async (_chatId: string, text: string) => {
      await Promise.resolve();
      sentMessages.push(text);
      return true;
    },
  } as unknown as ZcaMessengerService;

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
  assert.match(sentMessages[0], /Vai trò: thành viên/);
  assert.match(sentMessages[0], /Google: đã kết nối bằng shared-admin@gmail\.com, dùng chung/);
  assert.match(sentMessages[0], /Google Drive/);
  assert.match(sentMessages[0], /Google Photos/);
});

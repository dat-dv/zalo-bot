import test from 'node:test';
import assert from 'node:assert/strict';
import { ZaloLogoutToolStrategy } from './zalo-logout-tool.strategy';
import type { ZcaMessengerService } from '../../zca-messenger.service';
import type { ZcaService } from '../../zca.service';
import type { UsersService } from '../../../users/users.service';
import type { AgentInput } from '../../../types/agent-input.type';

void test('ZaloLogoutToolStrategy rejects non-admin users', async () => {
  let sentMessage = '';
  let logoutCalled = false;

  const strategy = new ZaloLogoutToolStrategy(
    {
      sendMessage: (_id: string, msg: string) => {
        sentMessage = msg;
        return Promise.resolve();
      },
    } as unknown as ZcaMessengerService,
    {
      logout: () => {
        logoutCalled = true;
        return Promise.resolve({ success: true, message: 'ok' });
      },
      isLoggedIn: () => true,
    } as unknown as ZcaService,
    {
      isAdmin: () => false,
    } as unknown as UsersService,
  );

  await strategy.execute({
    chatId: 'chat-1',
    senderId: 'user-normal',
    displayName: 'Regular User',
    text: '/zca-logout',
    input: {} as unknown as AgentInput,
  });

  assert.match(sentMessage, /QUYỀN TRUY CẬP BỊ GIỚI HẠN/);
  assert.strictEqual(logoutCalled, false);
});

void test('ZaloLogoutToolStrategy notifies if ZCA is not currently logged in', async () => {
  let sentMessage = '';
  let logoutCalled = false;

  const strategy = new ZaloLogoutToolStrategy(
    {
      sendMessage: (_id: string, msg: string) => {
        sentMessage = msg;
        return Promise.resolve();
      },
    } as unknown as ZcaMessengerService,
    {
      logout: () => {
        logoutCalled = true;
        return Promise.resolve({ success: true, message: 'ok' });
      },
      isLoggedIn: () => false,
    } as unknown as ZcaService,
    {
      isAdmin: () => true,
    } as unknown as UsersService,
  );

  await strategy.execute({
    chatId: 'chat-1',
    senderId: 'admin-1',
    displayName: 'Admin User',
    text: '/zca-logout',
    input: {} as unknown as AgentInput,
  });

  assert.match(sentMessage, /CHƯA ĐĂNG NHẬP/);
  assert.strictEqual(logoutCalled, false);
});

void test('ZaloLogoutToolStrategy executes logout when admin requests and ZCA is logged in', async () => {
  let sentMessage = '';
  let logoutCalled = false;

  const strategy = new ZaloLogoutToolStrategy(
    {
      sendMessage: (_id: string, msg: string) => {
        sentMessage = msg;
        return Promise.resolve();
      },
    } as unknown as ZcaMessengerService,
    {
      logout: () => {
        logoutCalled = true;
        return Promise.resolve({ success: true, message: 'ok' });
      },
      isLoggedIn: () => true,
    } as unknown as ZcaService,
    {
      isAdmin: () => true,
    } as unknown as UsersService,
  );

  await strategy.execute({
    chatId: 'chat-1',
    senderId: 'admin-1',
    displayName: 'Admin User',
    text: '/zca-logout',
    input: {} as unknown as AgentInput,
  });

  assert.strictEqual(logoutCalled, true);
  assert.match(sentMessage, /ĐÃ ĐĂNG XUẤT TÀI KHOẢN ZCA THÀNH CÔNG/);
});

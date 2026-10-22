import test from 'node:test';
import assert from 'node:assert/strict';
import { InitialAdminBootstrapGuard } from './initial-admin-bootstrap.guard';
import { GrantAccessGuard } from './grant-access.guard';
import { AgentInput } from '../../types/agent-input.type';
import { UserRole, GrantAccessStatus } from '@zalobot/contracts';
import { UsersService } from '../../users/users.service';
import { ZcaService } from '../zca.service';

void test('InitialAdminBootstrapGuard promotes first user to admin when system has no users', async () => {
  let hasUsers = false;
  let bootstrappedUser = '';
  const sentMessages: Array<{ chatId: string; text: string }> = [];

  const mockUsersService = {
    hasAnyAdminOrWhitelistedUser: () => Promise.resolve(hasUsers),
    bootstrapFirstAdmin: (id: string, name?: string) => {
      bootstrappedUser = id;
      hasUsers = true;
      return Promise.resolve({
        id,
        role: UserRole.ADMIN,
        grantAccess: GrantAccessStatus.GRANTED,
        firstName: name,
      } as never);
    },
  } as unknown as UsersService;

  const mockZaloService = {
    sendMessage: (chatId: string, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve(true);
    },
  } as unknown as ZcaService;

  const guard = new InitialAdminBootstrapGuard(mockUsersService, mockZaloService);

  const firstInput: AgentInput = {
    type: 'text',
    senderId: 'user_first_123',
    chatId: 'user_first_123',
    displayName: 'Anh Dat',
    text: 'Xin chao bot',
  };

  const res1 = await guard.canActivate(firstInput);
  assert.equal(res1, true);
  assert.equal(bootstrappedUser, 'user_first_123');
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /QUẢN TRỊ VIÊN/);

  // Second user when system already has admin
  const secondInput: AgentInput = {
    type: 'text',
    senderId: 'user_second_456',
    chatId: 'user_second_456',
    displayName: 'Nguoi Thu Hai',
    text: 'Alo',
  };

  const res2 = await guard.canActivate(secondInput);
  assert.equal(res2, false);
});

void test('GrantAccessGuard saves pending user and rejects ungranted users with User ID message', async () => {
  const registeredUsers: string[] = [];
  const sentMessages: Array<{ chatId: string; text: string }> = [];
  const grantedUsers = new Set<string>(['admin_user']);

  const mockUsersService = {
    isAdmin: (id: string) => id === 'admin_user',
    registerPendingUser: (id: string) => {
      registeredUsers.push(id);
      return Promise.resolve({} as never);
    },
    isGrantAccess: (id: string) => {
      return Promise.resolve(grantedUsers.has(id));
    },
  } as unknown as UsersService;

  const mockZaloService = {
    sendMessage: (chatId: string, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve(true);
    },
  } as unknown as ZcaService;

  const guard = new GrantAccessGuard(mockUsersService, mockZaloService);

  // 1. Ungranted user
  const ungrantedInput: AgentInput = {
    type: 'text',
    senderId: 'stranger_999',
    chatId: 'stranger_999',
    displayName: 'Người Lạ',
    text: 'ăn trưa 50k',
  };

  const res1 = await guard.canActivate(ungrantedInput);
  assert.equal(res1, false);
  assert.equal(registeredUsers.includes('stranger_999'), true);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /CHƯA ĐƯỢC CẤP QUYỀN/);
  assert.match(sentMessages[0].text, /stranger_999/);

  // 2. Granted user
  const grantedInput: AgentInput = {
    type: 'text',
    senderId: 'admin_user',
    chatId: 'admin_user',
    displayName: 'Admin User',
    text: 'ăn trưa 50k',
  };

  const res2 = await guard.canActivate(grantedInput);
  assert.equal(res2, true);
  assert.equal(sentMessages.length, 1); // No new rejection message sent
});

void test('GrantAccessGuard lets a thread-granted member through but still registers them', async () => {
  const registeredUsers: string[] = [];
  const sentMessages: string[] = [];
  const mockUsersService = {
    isAdmin: () => false,
    registerPendingUser: (id: string) => {
      registeredUsers.push(id);
      return Promise.resolve({} as never);
    },
    isGrantAccess: () => Promise.resolve(false),
  } as unknown as UsersService;
  const mockZaloService = {
    sendMessage: (_chatId: string, text: string) => {
      sentMessages.push(text);
      return Promise.resolve(true);
    },
  } as unknown as ZcaService;
  const guard = new GrantAccessGuard(mockUsersService, mockZaloService);
  const input: AgentInput = {
    type: 'text',
    senderId: 'member_1',
    chatId: 'group_1',
    displayName: 'Thành viên',
    text: '@bot ăn trưa 50k',
  };

  assert.equal(await guard.canActivate(input, { threadGrant: true }), true);
  assert.deepEqual(registeredUsers, ['member_1']);
  assert.equal(sentMessages.length, 0);

  assert.equal(await guard.canActivate(input, { threadGrant: false }), false);
  assert.equal(sentMessages.length, 1);
});

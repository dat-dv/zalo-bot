import assert from 'node:assert/strict';
import test from 'node:test';
import { DeployNotifyService } from './deploy-notify.service';
import { UserEntity } from '../database/entities/user.entity';
import { UserRole, GrantAccessStatus } from '@zalobot/contracts';

void test('DeployNotifyService gracefully handles when no admin exists in the system', async () => {
  const usersService = {
    getAdminUsers: () => Promise.resolve([]),
  };
  let messageSent = false;
  const zaloService = {
    sendMessage: () => {
      messageSent = true;
      return Promise.resolve(true);
    },
  };

  const service = new DeployNotifyService(usersService as never, zaloService as never);

  const result = await service.notifyDeploy({
    version: '1.0.0',
    environment: 'production',
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.notified, false);
  assert.equal(result.adminCount, 0);
  assert.equal(messageSent, false);
});

void test('DeployNotifyService sends message to all admins upon successful deployment', async () => {
  const admin1: UserEntity = {
    id: 'admin_123',
    username: 'boss',
    firstName: 'Đạt',
    role: UserRole.ADMIN,
    grantAccess: GrantAccessStatus.GRANTED,
    preferredLocale: 'vi',
    timezone: 'Asia/Ho_Chi_Minh',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const admin2: UserEntity = {
    id: 'admin_456',
    role: UserRole.ADMIN,
    grantAccess: GrantAccessStatus.GRANTED,
    preferredLocale: 'vi',
    timezone: 'Asia/Ho_Chi_Minh',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sentMessages: Array<{ chatId: string; text: string }> = [];
  const usersService = {
    getAdminUsers: () => Promise.resolve([admin1, admin2]),
  };
  const zaloService = {
    sendMessage: (chatId: string, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve(true);
    },
  };

  const service = new DeployNotifyService(usersService as never, zaloService as never);

  const result = await service.notifyDeploy({
    version: 'v2.1.0',
    commit: 'abc1234',
    branch: 'main',
    environment: 'production',
    message: 'Cập nhật tính năng gộp nơi chốn',
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.notified, true);
  assert.equal(result.adminCount, 2);
  assert.deepEqual(result.recipients, ['@boss', 'admin_456']);

  assert.equal(sentMessages.length, 2);
  assert.equal(sentMessages[0].chatId, 'admin_123');
  assert.equal(sentMessages[1].chatId, 'admin_456');

  // Verify message content
  assert.match(sentMessages[0].text, /THÔNG BÁO TRIỂN KHAI/);
  assert.match(sentMessages[0].text, /v2\.1\.0/);
  assert.match(sentMessages[0].text, /abc1234/);
  assert.match(sentMessages[0].text, /Cập nhật tính năng gộp nơi chốn/);
});

void test('DeployNotifyService resolves version from APP_VERSION env correctly', () => {
  const oldVersion = process.env.APP_VERSION;
  try {
    process.env.APP_VERSION = 'v3.5.0';
    const service = new DeployNotifyService({} as never, {} as never);
    assert.equal(service.resolveVersion(), 'v3.5.0');

    process.env.APP_VERSION = '3.5.0';
    assert.equal(service.resolveVersion(), 'v3.5.0');
  } finally {
    if (oldVersion === undefined) {
      delete process.env.APP_VERSION;
    } else {
      process.env.APP_VERSION = oldVersion;
    }
  }
});

void test('DeployNotifyService triggers startup deploy notification automatically', async () => {
  const admin: UserEntity = {
    id: 'admin_startup',
    username: 'admin',
    role: UserRole.ADMIN,
    grantAccess: GrantAccessStatus.GRANTED,
    preferredLocale: 'vi',
    timezone: 'Asia/Ho_Chi_Minh',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sentMessages: Array<{ chatId: string; text: string }> = [];
  const usersService = {
    getAdminUsers: () => Promise.resolve([admin]),
  };
  const zaloService = {
    sendMessage: (chatId: string, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve(true);
    },
  };

  const oldAppVersion = process.env.APP_VERSION;
  try {
    process.env.APP_VERSION = 'v1.2.3';
    const service = new DeployNotifyService(usersService as never, zaloService as never);
    const result = await service.triggerStartupNotify();

    assert.ok(result);
    assert.equal(result?.status, 'ok');
    assert.equal(result?.notified, true);
    assert.equal(sentMessages.length, 1);
    assert.match(sentMessages[0].text, /v1\.2\.3/);
    assert.match(sentMessages[0].text, /Hệ thống đã khởi động và sẵn sàng hoạt động/);
  } finally {
    if (oldAppVersion === undefined) {
      delete process.env.APP_VERSION;
    } else {
      process.env.APP_VERSION = oldAppVersion;
    }
  }
});

void test('DeployNotifyService resolveChangelog extracts items from CHANGELOG.md', () => {
  const service = new DeployNotifyService({} as never, {} as never);
  const changelog = service.resolveChangelog();
  assert.ok(Array.isArray(changelog));
  if (changelog.length > 0) {
    assert.ok(typeof changelog[0] === 'string');
    assert.ok(changelog.length <= 5);
  }
});


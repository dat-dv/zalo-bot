import test from 'node:test';
import assert from 'node:assert/strict';
import { GetStorageLinksToolStrategy } from './get-storage-links-tool.strategy';
import type { ZaloService } from '../../zalo.service';
import type { GoogleAuthService } from '../../../google/google-auth.service';
import type { GoogleDriveService } from '../../../google/google-drive.service';
import type { ThreadConfigService } from '../../../zca/thread-config.service';
import type { UsersService } from '../../../users/users.service';

void test('GetStorageLinksToolStrategy outputs channel-specific links and permission help prompt', async () => {
  let sentMessage = '';
  const mockZaloService = {
    sendMessage: async (_chatId: string, msg: string) => {
      sentMessage = msg;
    },
  } as unknown as ZaloService;

  const mockGoogleAuth = {
    isSharedAuthorized: () => true,
    hasStorageScopes: () => true,
  } as unknown as GoogleAuthService;

  const mockDrive = {
    getFolderWebLink: async (path: string) => `https://drive.mock/${path}`,
  } as unknown as GoogleDriveService;

  let savedThreadFolder: any = null;
  const mockThreadConfig = {
    saveDriveFolderInfo: async (threadId: string, info: any) => {
      savedThreadFolder = { threadId, ...info };
    },
  } as unknown as ThreadConfigService;

  const strategy = new GetStorageLinksToolStrategy(
    mockZaloService,
    mockGoogleAuth,
    mockDrive,
    undefined,
    undefined,
    mockThreadConfig,
  );

  await strategy.execute({
    chatId: 'g-12345',
    senderId: 'user-1',
    displayName: 'Dat Doan',
    text: '/drive',
    input: {} as any,
  });

  assert.match(sentMessage, /Thư mục nhóm/);
  assert.match(sentMessage, /zalobot\/g-12345\/bill/);
  assert.match(sentMessage, /zalobot\/g-12345\/image/);
  assert.match(sentMessage, /zalobot\/g-12345\/video/);
  assert.match(sentMessage, /@bot share <gmail của bạn>/);
  assert.equal(savedThreadFolder?.threadId, 'g-12345');
  assert.equal(savedThreadFolder?.folderPath, 'zalobot/g-12345');
});

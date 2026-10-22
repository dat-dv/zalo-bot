import test from 'node:test';
import assert from 'node:assert/strict';
import { ShareDriveToolStrategy } from './share-drive-tool.strategy';
import type { ZcaMessengerService } from '../../zca-messenger.service';
import type { GoogleAuthService } from '../../../google/google-auth.service';
import type { GoogleDriveService } from '../../../google/google-drive.service';
import type { ThreadConfigService } from '../../thread-config.service';
import type { AgentInput } from '../../../types/agent-input.type';

void test('ShareDriveToolStrategy rejects when Google is not connected', async () => {
  let sentMessage = '';
  const strategy = new ShareDriveToolStrategy(
    {
      sendMessage: (_id: string, msg: string) => {
        sentMessage = msg;
        return Promise.resolve();
      },
    } as unknown as ZcaMessengerService,
    {
      isSharedAuthorized: () => false,
      hasStorageScopes: () => false,
    } as unknown as GoogleAuthService,
  );

  await strategy.execute({
    chatId: 'g-12345',
    senderId: 'user-1',
    displayName: 'Dat Doan',
    text: '@bot share test@gmail.com',
    input: {} as unknown as AgentInput,
  });

  assert.match(sentMessage, /CHƯA ĐƯỢC KẾT NỐI/);
});

void test('ShareDriveToolStrategy rejects invalid email address', async () => {
  let sentMessage = '';
  const strategy = new ShareDriveToolStrategy(
    {
      sendMessage: (_id: string, msg: string) => {
        sentMessage = msg;
        return Promise.resolve();
      },
    } as unknown as ZcaMessengerService,
    {
      isSharedAuthorized: () => true,
      hasStorageScopes: () => true,
    } as unknown as GoogleAuthService,
    {} as unknown as GoogleDriveService,
  );

  await strategy.execute({
    chatId: 'g-12345',
    senderId: 'user-1',
    displayName: 'Dat Doan',
    text: '@bot share not-an-email',
    input: {} as unknown as AgentInput,
  });

  assert.match(sentMessage, /Email không hợp lệ/);
});

void test('ShareDriveToolStrategy shares channel folder with valid email', async () => {
  let sentMessage = '';
  let sharedFolder = '';
  let sharedEmail = '';
  const mockDrive = {
    getFolderWebLink: () => Promise.resolve('https://drive.mock/folder'),
    shareFolderWithUser: (folder: string, email: string) => {
      sharedFolder = folder;
      sharedEmail = email;
      return Promise.resolve({
        fileId: '1',
        permissionId: 'p1',
        emailAddress: email,
        role: 'reader',
      });
    },
  } as unknown as GoogleDriveService;

  let savedFolderInfo: Record<string, unknown> | null = null;
  const mockThreadConfig = {
    isGroupThread: (threadId: string) => Promise.resolve(threadId.startsWith('g-')),
    saveDriveFolderInfo: (threadId: string, info: Record<string, unknown>) => {
      savedFolderInfo = { threadId, ...info };
      return Promise.resolve();
    },
  } as unknown as ThreadConfigService;

  const strategy = new ShareDriveToolStrategy(
    {
      sendMessage: (_id: string, msg: string) => {
        sentMessage = msg;
        return Promise.resolve();
      },
    } as unknown as ZcaMessengerService,
    {
      isSharedAuthorized: () => true,
      hasStorageScopes: () => true,
    } as unknown as GoogleAuthService,
    mockDrive,
    undefined,
    mockThreadConfig,
  );

  await strategy.execute({
    chatId: 'g-12345',
    senderId: 'user-1',
    displayName: 'Dat Doan',
    text: '@bot share myemail@gmail.com',
    input: {} as unknown as AgentInput,
  });

  assert.equal(sharedEmail, 'myemail@gmail.com');
  assert.equal(sharedFolder, 'zalobot/g-12345');
  assert.match(sentMessage, /ĐÃ CẤP QUYỀN TRUY CẬP GOOGLE DRIVE/);
  assert.match(sentMessage, /myemail@gmail.com/);
  assert.equal(savedFolderInfo?.threadId, 'g-12345');
  assert.equal(savedFolderInfo?.folderPath, 'zalobot/g-12345');
});

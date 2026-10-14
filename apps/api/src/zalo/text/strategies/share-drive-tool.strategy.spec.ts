import test from 'node:test';
import assert from 'node:assert/strict';
import { ShareDriveToolStrategy } from './share-drive-tool.strategy';
import type { ZaloService } from '../../zalo.service';
import type { GoogleAuthService } from '../../../google/google-auth.service';
import type { GoogleDriveService } from '../../../google/google-drive.service';
import type { ThreadConfigService } from '../../../zca/thread-config.service';
import type { UsersService } from '../../../users/users.service';

void test('ShareDriveToolStrategy rejects when Google is not connected', async () => {
  let sentMessage = '';
  const strategy = new ShareDriveToolStrategy(
    {
      sendMessage: async (_id: string, msg: string) => {
        sentMessage = msg;
      },
    } as unknown as ZaloService,
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
    input: {} as any,
  });

  assert.match(sentMessage, /CHƯA ĐƯỢC KẾT NỐI/);
});

void test('ShareDriveToolStrategy rejects invalid email address', async () => {
  let sentMessage = '';
  const strategy = new ShareDriveToolStrategy(
    {
      sendMessage: async (_id: string, msg: string) => {
        sentMessage = msg;
      },
    } as unknown as ZaloService,
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
    input: {} as any,
  });

  assert.match(sentMessage, /Email không hợp lệ/);
});

void test('ShareDriveToolStrategy shares channel folder with valid email', async () => {
  let sentMessage = '';
  let sharedFolder = '';
  let sharedEmail = '';
  const mockDrive = {
    getFolderWebLink: async () => 'https://drive.mock/folder',
    shareFolderWithUser: async (folder: string, email: string) => {
      sharedFolder = folder;
      sharedEmail = email;
      return { fileId: '1', permissionId: 'p1', emailAddress: email, role: 'reader' };
    },
  } as unknown as GoogleDriveService;

  let savedFolderInfo: any = null;
  const mockThreadConfig = {
    saveDriveFolderInfo: async (threadId: string, info: any) => {
      savedFolderInfo = { threadId, ...info };
    },
  } as unknown as ThreadConfigService;

  const strategy = new ShareDriveToolStrategy(
    {
      sendMessage: async (_id: string, msg: string) => {
        sentMessage = msg;
      },
    } as unknown as ZaloService,
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
    input: {} as any,
  });

  assert.equal(sharedEmail, 'myemail@gmail.com');
  assert.equal(sharedFolder, 'zalobot/g-12345');
  assert.match(sentMessage, /ĐÃ CẤP QUYỀN TRUY CẬP GOOGLE DRIVE/);
  assert.match(sentMessage, /myemail@gmail.com/);
  assert.equal(savedFolderInfo?.threadId, 'g-12345');
  assert.equal(savedFolderInfo?.folderPath, 'zalobot/g-12345');
});

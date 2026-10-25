import test from 'node:test';
import assert from 'node:assert/strict';
import { GetStorageLinksToolStrategy } from './get-storage-links-tool.strategy';
import type { ZcaMessengerService } from '../../zca-messenger.service';
import type { GoogleAuthService } from '../../../google/google-auth.service';
import type { GoogleDriveService } from '../../../google/google-drive.service';
import type { ThreadConfigService } from '../../thread-config.service';
import type { UsersService } from '../../../users/users.service';
import type { AgentInput } from '../../../types/agent-input.type';
import type { ChannelStorageLinkService } from '../../storage/channel-storage-link.service';
import {
  buildChannelStorageTarget,
  type ChannelStorageTarget,
} from '../../../google/channel-storage.util';

void test('GetStorageLinksToolStrategy outputs channel-specific links and permission help prompt', async () => {
  let sentMessage = '';
  const mockZaloService = {
    sendMessage: (_chatId: string, msg: string) => {
      sentMessage = msg;
      return Promise.resolve();
    },
  } as unknown as ZcaMessengerService;

  const mockGoogleAuth = {
    isSharedAuthorized: () => true,
    hasStorageScopes: () => true,
  } as unknown as GoogleAuthService;

  const mockDrive = {
    getFolderWebLink: (path: string) => Promise.resolve(`https://drive.mock/${path}`),
  } as unknown as GoogleDriveService;

  let savedThreadFolder: Record<string, unknown> | null = null;
  const mockThreadConfig = {
    isGroupThread: (threadId: string) => Promise.resolve(threadId.startsWith('g-')),
    saveDriveFolderInfo: (threadId: string, info: Record<string, unknown>) => {
      savedThreadFolder = { threadId, ...info };
      return Promise.resolve();
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
    input: {} as unknown as AgentInput,
  });

  assert.match(sentMessage, /^📦 Kho lưu trữ Google của bot\n/);
  assert.match(sentMessage, /• Thư mục nhóm: https:\/\/drive\.mock\/zalobot\/g-12345\n/);
  assert.match(sentMessage, /• Hoá đơn \[zalobot\/g-12345\/bill\]: /);
  assert.match(sentMessage, /zalobot\/g-12345\/bill/);
  assert.match(sentMessage, /zalobot\/g-12345\/image/);
  assert.match(sentMessage, /zalobot\/g-12345\/video/);
  assert.match(sentMessage, /@bot share <gmail của bạn>/);
  assert.doesNotMatch(sentMessage, /\n\n/, 'no empty lines');
  assert.equal(savedThreadFolder?.threadId, 'g-12345');
  assert.equal(savedThreadFolder?.folderPath, 'zalobot/g-12345');
});

void test('GetStorageLinksToolStrategy schedules auto-recall after 5 minutes and cleans up loading message', async () => {
  const sentMessages: string[] = [];
  const undoneMessages: Array<{ chatId: string | number; msgId: string; cliMsgId?: string }> = [];

  const mockZaloService = {
    sendMessage: (_chatId: string, msg: string) => {
      sentMessages.push(msg);
      return Promise.resolve();
    },
    sendMessageWithResult: (_chatId: string | number, msg: string) => {
      sentMessages.push(msg);
      const isProgress = msg.includes('Đang lấy');
      return Promise.resolve({
        success: true,
        msgId: isProgress ? 'loading-msg-1' : 'main-msg-2',
        cliMsgId: isProgress ? 'cli-loading-1' : 'cli-main-2',
      });
    },
    undoMessage: (chatId: string | number, msgId: string, cliMsgId?: string) => {
      undoneMessages.push({ chatId, msgId, cliMsgId });
      return Promise.resolve(true);
    },
  } as unknown as ZcaMessengerService;

  const mockGoogleAuth = {
    isSharedAuthorized: () => true,
    hasStorageScopes: () => true,
  } as unknown as GoogleAuthService;

  const mockDrive = {
    getFolderWebLink: (path: string) => Promise.resolve(`https://drive.mock/${path}`),
  } as unknown as GoogleDriveService;

  const strategy = new GetStorageLinksToolStrategy(
    mockZaloService,
    mockGoogleAuth,
    mockDrive,
    undefined,
    undefined,
    undefined,
    10, // recallDelayMs = 10ms for fast test execution
  );

  await strategy.execute({
    chatId: 'g-12345',
    senderId: 'user-1',
    displayName: 'Dat Doan',
    text: '/drive',
    input: {} as unknown as AgentInput,
  });

  // Verify loading message was recalled immediately
  assert.ok(undoneMessages.some((m) => m.msgId === 'loading-msg-1'));

  // Main message should have the 5-minute notice
  const mainMsg = sentMessages.find((m) => m.includes('Kho lưu trữ Google'));
  assert.ok(mainMsg);
  assert.match(mainMsg, /5 phút/);

  // Before delay expires, main message shouldn't be recalled yet
  assert.ok(!undoneMessages.some((m) => m.msgId === 'main-msg-2'));

  // Wait for recall delay
  await new Promise((resolve) => setTimeout(resolve, 30));

  // After delay expires, main message should be recalled
  assert.ok(undoneMessages.some((m) => m.msgId === 'main-msg-2'));
});

void test('GetStorageLinksToolStrategy saves numeric ZCA group folder on thread config, never on users', async () => {
  const mockZaloService = {
    sendMessage: () => Promise.resolve(),
  } as unknown as ZcaMessengerService;
  const mockGoogleAuth = {
    isSharedAuthorized: () => true,
    hasStorageScopes: () => true,
  } as unknown as GoogleAuthService;
  const mockDrive = {
    getFolderWebLink: (path: string) => Promise.resolve(`https://drive.mock/${path}`),
  } as unknown as GoogleDriveService;

  const savedThreadIds: string[] = [];
  const savedUserIds: string[] = [];
  const mockThreadConfig = {
    isGroupThread: (threadId: string) => Promise.resolve(threadId === '7120342145544273834'),
    saveDriveFolderInfo: (threadId: string) => {
      savedThreadIds.push(threadId);
      return Promise.resolve();
    },
  } as unknown as ThreadConfigService;
  const mockUsers = {
    saveDriveFolderInfo: (userId: string) => {
      savedUserIds.push(userId);
      return Promise.resolve();
    },
  } as unknown as UsersService;

  const strategy = new GetStorageLinksToolStrategy(
    mockZaloService,
    mockGoogleAuth,
    mockDrive,
    undefined,
    mockUsers,
    mockThreadConfig,
  );

  await strategy.execute({
    chatId: '7120342145544273834',
    senderId: 'user-1',
    displayName: 'Dat Doan',
    text: '/drive',
    input: {} as unknown as AgentInput,
  });

  assert.deepEqual(savedThreadIds, ['7120342145544273834']);
  assert.deepEqual(savedUserIds, []);
});

async function runStorageLinks(options: {
  target: ChannelStorageTarget;
  albums?: Record<string, string>;
}): Promise<{ message: string; drivePaths: string[] }> {
  let message = '';
  const drivePaths: string[] = [];
  const strategy = new GetStorageLinksToolStrategy(
    {
      sendMessage: (_chatId: string, msg: string) => {
        message = msg;
        return Promise.resolve();
      },
    } as unknown as ZcaMessengerService,
    {
      isSharedAuthorized: () => true,
      hasStorageScopes: () => true,
      getSharedAccountEmail: () => Promise.resolve('shared@gmail.com'),
    } as unknown as GoogleAuthService,
    {
      getFolderWebLink: (path: string) => {
        drivePaths.push(path);
        return Promise.resolve(`https://drive.mock/${path}`);
      },
    } as unknown as GoogleDriveService,
    {
      findAlbum: (threadId: string, email: string, title: string) => {
        const url = options.albums?.[`${threadId}|${email}|${title}`];
        return Promise.resolve(url ? { resourceId: 'album-id', url } : null);
      },
    } as unknown as ChannelStorageLinkService,
    undefined,
    {
      getStorageTarget: () => Promise.resolve(options.target),
      isGroupThread: () => Promise.resolve(true),
      saveDriveFolderInfo: () => Promise.resolve(),
    } as unknown as ThreadConfigService,
  );

  await strategy.execute({
    chatId: options.target.channelId,
    senderId: 'user-1',
    displayName: 'Dat Doan',
    text: '/album',
    input: {} as unknown as AgentInput,
  });
  return { message, drivePaths };
}

void test('GetStorageLinksToolStrategy shows the channel album recorded for the current account', async () => {
  const { message } = await runStorageLinks({
    target: buildChannelStorageTarget('g-12345', { threadName: 'Nhà' }),
    albums: { 'g-12345|shared@gmail.com|[Zalo] Nhà': 'https://photos.app.goo.gl/nha' },
  });

  assert.match(
    message,
    /• Album Google Photos "\[Zalo\] Nhà": https:\/\/photos\.app\.goo\.gl\/nha\n/,
  );
  assert.doesNotMatch(message, /ZaloBot - /);
});

void test('GetStorageLinksToolStrategy says the album comes with the first media when none is recorded', async () => {
  const { message } = await runStorageLinks({
    target: buildChannelStorageTarget('g-12345', { threadName: 'Nhà' }),
  });

  assert.match(
    message,
    /• Album Google Photos "\[Zalo\] Nhà": chưa có, album được tạo khi gửi ảnh\/hoá đơn\/video đầu tiên\n/,
  );
});

void test('GetStorageLinksToolStrategy lists only the custom folder, never category folders it would create', async () => {
  const { message, drivePaths } = await runStorageLinks({
    target: buildChannelStorageTarget('g-12345', { customFolder: 'Nhà/Chung' }),
  });

  assert.deepEqual(drivePaths.sort(), ['Nhà/Chung', 'zalobot']);
  assert.doesNotMatch(message, /• Hoá đơn|zalobot\/g-12345/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { GetStorageLinksToolStrategy } from './get-storage-links-tool.strategy';
import type { ZaloService } from '../../zalo.service';
import type { GoogleAuthService } from '../../../google/google-auth.service';
import type { GoogleDriveService } from '../../../google/google-drive.service';
import type { ThreadConfigService } from '../../../zca/thread-config.service';
import type { AgentInput } from '../../types/agent-input.type';

void test('GetStorageLinksToolStrategy outputs channel-specific links and permission help prompt', async () => {
  let sentMessage = '';
  const mockZaloService = {
    sendMessage: (_chatId: string, msg: string) => {
      sentMessage = msg;
      return Promise.resolve();
    },
  } as unknown as ZaloService;

  const mockGoogleAuth = {
    isSharedAuthorized: () => true,
    hasStorageScopes: () => true,
  } as unknown as GoogleAuthService;

  const mockDrive = {
    getFolderWebLink: (path: string) => Promise.resolve(`https://drive.mock/${path}`),
  } as unknown as GoogleDriveService;

  let savedThreadFolder: Record<string, unknown> | null = null;
  const mockThreadConfig = {
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

  assert.match(sentMessage, /Thư mục nhóm/);
  assert.match(sentMessage, /zalobot\/g-12345\/bill/);
  assert.match(sentMessage, /zalobot\/g-12345\/image/);
  assert.match(sentMessage, /zalobot\/g-12345\/video/);
  assert.match(sentMessage, /@bot share <gmail của bạn>/);
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
  } as unknown as ZaloService;

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
  const mainMsg = sentMessages.find((m) => m.includes('KHO LƯU TRỮ GOOGLE'));
  assert.ok(mainMsg);
  assert.match(mainMsg, /5 phút/);

  // Before delay expires, main message shouldn't be recalled yet
  assert.ok(!undoneMessages.some((m) => m.msgId === 'main-msg-2'));

  // Wait for recall delay
  await new Promise((resolve) => setTimeout(resolve, 30));

  // After delay expires, main message should be recalled
  assert.ok(undoneMessages.some((m) => m.msgId === 'main-msg-2'));
});

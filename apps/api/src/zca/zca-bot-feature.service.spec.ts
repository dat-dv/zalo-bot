import test from 'node:test';
import assert from 'node:assert/strict';
import { ZcaBotFeatureService, extractMediaUrl } from './zca-bot-feature.service';
import { ThreadConfigService } from './thread-config.service';
import { ThreadType, type API, type Message, type Reaction } from './shapes';
import type { TransactionConfirmationService } from '../zalo/transaction-confirmation.service';
import type { TextInputService } from '../zalo/text/text-input.service';
import type { ZcaService } from './zca.service';
import type { AgentInput } from '../zalo/types/agent-input.type';

void test('extractMediaUrl extracts url correctly from string or json or object', () => {
  assert.equal(extractMediaUrl('https://example.com/image.png'), 'https://example.com/image.png');
  assert.equal(
    extractMediaUrl(JSON.stringify({ href: 'https://example.com/parsed.jpg' })),
    'https://example.com/parsed.jpg',
  );
  assert.equal(
    extractMediaUrl({ hdUrl: 'https://example.com/hd.jpg' }),
    'https://example.com/hd.jpg',
  );
  assert.equal(extractMediaUrl(null), null);
});

void test('ZcaBotFeatureService ignores messages from unlistened threads', async () => {
  const configService = new ThreadConfigService();
  const service = new ZcaBotFeatureService(configService);

  let sentMessage = '';
  const mockApi = {
    sendMessage: (content: string | { msg: string }) => {
      sentMessage = typeof content === 'string' ? content : content.msg;
      return Promise.resolve({ message: { msgId: 1 }, attachment: [] });
    },
  } as unknown as API;

  const message = {
    threadId: 'unlistened-123',
    isSelf: false,
    type: ThreadType.Group,
    data: {
      content: 'Hello bot',
      uidFrom: 'u1',
      msgType: 'chat',
    },
  } as unknown as Message;

  await service.onMessage(message, mockApi);
  assert.equal(sentMessage, '');
});

void test('ZcaBotFeatureService dispatches reaction confirmations', async () => {
  const configService = new ThreadConfigService();
  const threadId = `reaction-thread-${Date.now()}`;
  await configService.updateConfig(threadId, {
    isListened: true,
    confirmationRules: {
      allowReactions: true,
      requiredHearts: 2,
      timeoutMinutes: 5,
    },
  });

  interface ReactionArgs {
    chatId: string;
    userId: string;
    reactionIcon: string;
    msgId?: string;
  }
  let reactionHandledArgs: ReactionArgs | null = null;
  const mockConfirmationService = {
    handleReaction: (args: ReactionArgs) => {
      reactionHandledArgs = args;
      return Promise.resolve({
        handled: true,
        status: 'heart_added' as const,
        currentHearts: 1,
        requiredHearts: 2,
        code: '555',
      });
    },
  } as unknown as TransactionConfirmationService;

  const service = new ZcaBotFeatureService(configService, mockConfirmationService);

  const sentReplies: string[] = [];
  const mockApi = {
    sendMessage: (msg: string | { msg: string }) => {
      sentReplies.push(typeof msg === 'string' ? msg : msg.msg);
      return Promise.resolve({ message: { msgId: 2 }, attachment: [] });
    },
  } as unknown as API;

  const reaction = {
    threadId,
    isSelf: false,
    isGroup: true,
    data: {
      uidFrom: 'user-xyz',
      content: {
        rIcon: '/-heart',
        rMsg: [{ gMsgID: 'msg-999', cMsgID: 'c-999', msgType: 1 }],
      },
    },
  } as unknown as Reaction;

  await service.onReaction(reaction, mockApi);

  assert.ok(reactionHandledArgs);
  assert.equal(reactionHandledArgs.chatId, threadId);
  assert.equal(reactionHandledArgs.reactionIcon, '/-heart');
  assert.equal(reactionHandledArgs.msgId, 'msg-999');
  assert.equal(sentReplies.length, 1);
  assert.match(sentReplies[0], /1\/2 lượt thả tim/);
});

void test('ZcaBotFeatureService ignores isSelf message when allowSelf is false', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'self-thread-1';
  await configService.updateConfig(threadId, {
    isListened: true,
    directInteraction: {
      enabled: true,
      requireMention: false,
      allowSelf: false,
    },
  });

  let processedInput: AgentInput | null = null;
  const mockTextInputService = {
    process: (input: AgentInput) => {
      processedInput = input;
      return Promise.resolve();
    },
  } as unknown as TextInputService;

  const service = new ZcaBotFeatureService(configService);
  service.setTextInputService(mockTextInputService);

  const message = {
    threadId,
    isSelf: true,
    type: ThreadType.User,
    data: {
      content: '@Bot hi',
      uidFrom: 'owner-id',
      msgType: 'chat',
    },
  } as unknown as Message;

  await service.onMessage(message, {} as unknown as API);
  assert.equal(processedInput, null, 'Message should have been ignored because allowSelf is false');
});

void test('ZcaBotFeatureService processes isSelf message when allowSelf is true and message not from bot itself', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'self-thread-2';
  await configService.updateConfig(threadId, {
    isListened: true,
    directInteraction: {
      enabled: true,
      requireMention: false,
      allowSelf: true,
    },
  });

  let processedInput: AgentInput | null = null;
  const mockTextInputService = {
    process: (input: AgentInput) => {
      processedInput = input;
      return Promise.resolve();
    },
  } as unknown as TextInputService;

  const mockZcaService = {
    isBotSentMessage: () => false,
  } as unknown as ZcaService;

  const service = new ZcaBotFeatureService(configService);
  service.setTextInputService(mockTextInputService);
  service.setZcaService(mockZcaService);

  const message = {
    threadId,
    isSelf: true,
    type: ThreadType.User,
    data: {
      content: '@Bot hi',
      uidFrom: 'owner-id',
      dName: 'Văn Đạt',
      msgType: 'chat',
    },
  } as unknown as Message;

  await service.onMessage(message, {} as unknown as API);
  assert.ok(processedInput, 'Message should have been processed because allowSelf is true');
  assert.equal(processedInput.text, '@Bot hi');
  assert.equal(processedInput.displayName, 'Văn Đạt');
});

void test('ZcaBotFeatureService drops isSelf message when allowSelf is true but originated by bot process (loop prevention)', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'self-thread-3';
  await configService.updateConfig(threadId, {
    isListened: true,
    directInteraction: {
      enabled: true,
      requireMention: false,
      allowSelf: true,
    },
  });

  let processedInput: AgentInput | null = null;
  const mockTextInputService = {
    process: (input: AgentInput) => {
      processedInput = input;
      return Promise.resolve();
    },
  } as unknown as TextInputService;

  const mockZcaService = {
    isBotSentMessage: () => true, // Identified as bot reply
  } as unknown as ZcaService;

  const service = new ZcaBotFeatureService(configService);
  service.setTextInputService(mockTextInputService);
  service.setZcaService(mockZcaService);

  const message = {
    threadId,
    isSelf: true,
    type: ThreadType.User,
    data: {
      content: 'Chào bạn! Tôi có thể giúp gì cho bạn?',
      uidFrom: 'owner-id',
      msgType: 'chat',
    },
  } as unknown as Message;

  await service.onMessage(message, {} as unknown as API);
  assert.equal(processedInput, null, 'Message should have been dropped to prevent infinite loop');
});

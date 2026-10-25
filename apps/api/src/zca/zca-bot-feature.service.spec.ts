import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZcaBotFeatureService,
  buildImageOcrPrompt,
  extractMediaUrl,
  extractQuotedImageUrl,
  extractTaggedUsers,
  isStorageUploadInstruction,
  stripBotMentions,
} from './zca-bot-feature.service';
import { ThreadConfigService } from './thread-config.service';
import { ThreadType, type API, type Message, type Reaction, type Undo } from './shapes';
import type { ChatMemoryService } from './memory/chat-memory.service';
import { ShortTermMemoryService } from './memory/short-term-memory.service';
import type { ImageTextJob, ImageTextMemoryService } from './memory/image-text-memory.service';
import type { OcrService } from '../ocr/ocr.service';
import type { TransactionConfirmationService } from './confirmation/transaction-confirmation.service';
import type { TextInputService } from './text/text-input.service';
import type { ZcaService } from './zca.service';
import type { AgentInput } from '../types/agent-input.type';
import type { UsersService } from '../users/users.service';
import { GrantAccessGuard } from './guards/grant-access.guard';

function createUsersServiceMock(options: { granted: string[] }): UsersService & {
  registered: string[];
} {
  const registered: string[] = [];
  const mock = {
    registered,
    isGrantAccess: (id: string) => Promise.resolve(options.granted.includes(id)),
    checkCooldown: () => ({ allowed: true }),
    registerPendingUser: (id: string) => {
      registered.push(id);
      return Promise.resolve();
    },
  };
  return mock as unknown as UsersService & { registered: string[] };
}

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

void test('ZcaBotFeatureService processes isSelf message when ZCA_SELF_LISTEN env is true even if thread allowSelf is false', async () => {
  const previousEnv = process.env.ZCA_SELF_LISTEN;
  process.env.ZCA_SELF_LISTEN = 'true';
  try {
    const configService = new ThreadConfigService();
    const threadId = 'self-thread-env-override';
    await configService.updateConfig(threadId, {
      isListened: true,
      directInteraction: {
        enabled: true,
        allowSelf: false, // thread config is false, but env is true!
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
        content: '@Bot nợ a 50k',
        uidFrom: 'owner-id',
        dName: 'Chủ Bot',
        msgType: 'chat',
      },
    } as unknown as Message;

    await service.onMessage(message, {} as unknown as API);
    assert.ok(
      processedInput,
      'Message should have been processed because ZCA_SELF_LISTEN env is true',
    );
    assert.equal(processedInput.text, '@Bot nợ a 50k');
  } finally {
    if (previousEnv !== undefined) {
      process.env.ZCA_SELF_LISTEN = previousEnv;
    } else {
      delete process.env.ZCA_SELF_LISTEN;
    }
  }
});

void test('ZcaBotFeatureService processes @bot mention in listened group even if directConfig.enabled is false', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'group-thread-disabled-direct';
  await configService.updateConfig(threadId, {
    isListened: true,
    directInteraction: {
      enabled: false, // directInteraction is disabled
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
    isSelf: false,
    type: ThreadType.Group,
    data: {
      content: '@Bot xin chào bạn',
      uidFrom: 'member-123',
      dName: 'Thành viên nhóm',
      msgType: 'chat',
    },
  } as unknown as Message;

  await service.onMessage(message, {} as unknown as API);
  assert.ok(
    processedInput,
    'Message should have been processed because user explicitly called @Bot in listened group',
  );
  assert.equal(processedInput.text, '@Bot xin chào bạn');
});

void test('stripBotMentions removes only the bot mention entity, then @bot aliases', () => {
  const botMention = [{ uid: 'bot-uid', pos: 0, len: 4, type: 0 }];
  assert.equal(
    stripBotMentions('@Đen edit 125 quán steak', botMention, 'bot-uid', 'Bot'),
    'edit 125 quán steak',
  );
  assert.equal(stripBotMentions('@bot yes 123', undefined, 'bot-uid', 'Bot'), 'yes 123');
  assert.equal(
    stripBotMentions('yes 123 @Trí', [{ uid: 'tri-uid', pos: 8, len: 4 }], 'bot-uid', 'Bot'),
    'yes 123 @Trí',
  );
  assert.equal(
    stripBotMentions(
      '@Trí @Đen, cancel 456',
      [
        { uid: 'tri-uid', pos: 0, len: 4 },
        { uid: 'bot-uid', pos: 5, len: 4 },
      ],
      'bot-uid',
      'Bot',
    ),
    '@Trí cancel 456',
  );
  // Out-of-range entities are ignored instead of corrupting the text.
  assert.equal(
    stripBotMentions('yes 1', [{ uid: 'bot-uid', pos: 3, len: 10 }], 'bot-uid', 'Bot'),
    'yes 1',
  );
});

void test('ZcaBotFeatureService strips leading bot mention before pending commands ("@Đen edit 125 …")', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'group-edit-mention-test';
  await configService.updateConfig(threadId, {
    threadType: 'group',
    isListened: true,
    directInteraction: { enabled: true, allowAiChat: true },
  });

  const commandTexts: string[] = [];
  let onEditText = '';
  let llmCalled = false;
  const mockConfirmationService = {
    handleReaction: () => Promise.resolve({ handled: false }),
    handleCommand: async (
      _senderId: string,
      _chatId: string,
      text: string,
      onEdit?: (pending: unknown, instruction: string) => Promise<void>,
    ) => {
      commandTexts.push(text);
      if (onEdit && text.startsWith('edit 125')) {
        await onEdit({ code: '125' }, 'quán steak bin & pizza');
        return true;
      }
      return false;
    },
  } as unknown as TransactionConfirmationService;

  const service = new ZcaBotFeatureService(configService, mockConfirmationService);
  service.setTextInputService({
    handleEditPendingAction: (input: AgentInput) => {
      onEditText = input.text || '';
      return Promise.resolve();
    },
    process: () => {
      llmCalled = true;
      return Promise.resolve();
    },
  } as unknown as TextInputService);

  const api = { getOwnId: () => 'bot-uid' } as unknown as API;
  await service.onMessage(
    {
      threadId,
      isSelf: false,
      type: ThreadType.Group,
      data: {
        content: '@Đen edit 125 quán steak bin & pizza',
        uidFrom: 'u-1',
        dName: 'Văn Đạt',
        msgType: 'webchat',
        mentions: [{ uid: 'bot-uid', pos: 0, len: 4, type: 0 }],
      },
    } as unknown as Message,
    api,
  );

  assert.deepEqual(commandTexts, ['edit 125 quán steak bin & pizza']);
  assert.equal(onEditText, 'edit 125 quán steak bin & pizza');
  assert.equal(llmCalled, false, 'edit command must not fall through to the LLM');
});

void test('ZcaBotFeatureService gives an edit command the people it tags ("@Đen edit 125 tag @Nam")', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'group-edit-tag-test';
  await configService.updateConfig(threadId, {
    threadType: 'group',
    isListened: true,
    directInteraction: { enabled: true, allowAiChat: true },
  });

  let editInput: AgentInput | undefined;
  const mockConfirmationService = {
    handleReaction: () => Promise.resolve({ handled: false }),
    handleCommand: async (
      _senderId: string,
      _chatId: string,
      text: string,
      onEdit?: (pending: unknown, instruction: string) => Promise<boolean>,
    ) => {
      if (!onEdit || !text.startsWith('edit 125')) return false;
      await onEdit({ code: '125' }, 'tag @Nam');
      return true;
    },
  } as unknown as TransactionConfirmationService;

  const service = new ZcaBotFeatureService(configService, mockConfirmationService);
  service.setTextInputService({
    handleEditPendingAction: (input: AgentInput) => {
      editInput = input;
      return Promise.resolve(true);
    },
    process: () => Promise.resolve(),
  } as unknown as TextInputService);

  await service.onMessage(
    {
      threadId,
      isSelf: false,
      type: ThreadType.Group,
      data: {
        msgId: 'm-edit-tag',
        content: '@Đen edit 125 tag @Nam',
        uidFrom: 'u-1',
        dName: 'Diệu Hằng',
        msgType: 'webchat',
        mentions: [
          { uid: 'bot-uid', pos: 0, len: 4, type: 0 },
          { uid: 'u-nam', pos: 18, len: 4, type: 0 },
        ],
      },
    } as unknown as Message,
    { getOwnId: () => 'bot-uid' } as unknown as API,
  );

  assert.equal(editInput?.text, 'edit 125 tag @Nam');
  assert.deepEqual(editInput?.taggedUsers, [{ id: 'u-nam', name: 'Nam' }]);
  assert.equal(editInput?.messageId, 'm-edit-tag');
});

void test('ZcaBotFeatureService passes onEdit handler to confirmationService.handleCommand', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'thread-edit-test';
  await configService.updateConfig(threadId, {
    isListened: true,
  });

  let editCalledWithPending: unknown = null;
  let editCalledWithInstruction = '';
  const mockTextInputService = {
    handleEditPendingAction: (_input: AgentInput, pending: unknown, instruction: string) => {
      editCalledWithPending = pending;
      editCalledWithInstruction = instruction;
      return Promise.resolve();
    },
  } as unknown as TextInputService;

  let passedOnEdit: ((pending: unknown, instruction: string) => Promise<void>) | undefined;
  const mockConfirmationService = {
    handleReaction: () => Promise.resolve({ handled: false }),
    handleCommand: (
      _senderId: string,
      _chatId: string,
      _text: string,
      onEdit?: (pending: unknown, instruction: string) => Promise<void>,
    ) => {
      passedOnEdit = onEdit;
      return Promise.resolve(true);
    },
  } as unknown as TransactionConfirmationService;

  const service = new ZcaBotFeatureService(configService, mockConfirmationService);
  service.setTextInputService(mockTextInputService);

  const message = {
    threadId,
    isSelf: false,
    type: ThreadType.User,
    data: {
      content: 'edit 123 change location to Office',
      uidFrom: 'user-1',
      dName: 'User One',
      msgType: 'chat',
    },
  } as unknown as Message;

  await service.onMessage(message, {} as unknown as API);
  assert.ok(passedOnEdit, 'onEdit should be provided to confirmationService.handleCommand');

  // Invoke the passed onEdit and verify it delegates to textInputService.handleEditPendingAction
  const fakePending = { code: '123' };
  await passedOnEdit(fakePending, 'change location to Office');
  assert.equal(editCalledWithPending, fakePending);
  assert.equal(editCalledWithInstruction, 'change location to Office');
});

void test('ZcaBotFeatureService ignores a group expense message that neither mentions the bot nor uses a prefix', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'group-no-mention-expense-test';
  await configService.updateConfig(threadId, {
    isListened: true,
    directInteraction: {
      enabled: true,
      triggerPrefixes: ['!'],
      allowAiChat: true,
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
  service.setUsersService(createUsersServiceMock({ granted: ['member-1'] }));

  const message = {
    threadId,
    isSelf: false,
    type: ThreadType.Group,
    data: {
      content: 'Chủ nhật rồi mua đồ bơi hết 300k ở lê trọng tấn',
      uidFrom: 'member-1',
      dName: 'Thành viên',
      msgType: 'chat',
    },
  } as unknown as Message;

  await service.onMessage(message, {} as unknown as API);
  assert.equal(processedInput, null, 'Un-addressed group text must never reach the AI');
});

void test('ZcaBotFeatureService processes group messages using any configured prefix (case-insensitive) or @bot', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'group-prefix-test';
  await configService.updateConfig(threadId, {
    isListened: true,
    directInteraction: {
      enabled: true,
      triggerPrefixes: ['!', 'bot:'],
      allowAiChat: true,
    },
  });

  const processedInputs: AgentInput[] = [];
  const mockTextInputService = {
    process: (input: AgentInput) => {
      processedInputs.push(input);
      return Promise.resolve();
    },
  } as unknown as TextInputService;

  const service = new ZcaBotFeatureService(configService);
  service.setTextInputService(mockTextInputService);

  // 1. Message with custom prefix "!"
  await service.onMessage(
    {
      threadId,
      isSelf: false,
      type: ThreadType.Group,
      data: {
        content: '!ăn trưa 50k',
        uidFrom: 'u1',
        dName: 'User 1',
        msgType: 'chat',
      },
    } as unknown as Message,
    {} as unknown as API,
  );

  // 2. Message with @Bot (even though prefixes are configured, @Bot still works!)
  await service.onMessage(
    {
      threadId,
      isSelf: false,
      type: ThreadType.Group,
      data: {
        content: '@Bot ê',
        uidFrom: 'u2',
        dName: 'User 2',
        msgType: 'chat',
      },
    } as unknown as Message,
    {} as unknown as API,
  );

  // 3. Second prefix, written in upper case
  await service.onMessage(
    {
      threadId,
      isSelf: false,
      type: ThreadType.Group,
      data: {
        content: 'BOT: cà phê 30k',
        uidFrom: 'u3',
        dName: 'User 3',
        msgType: 'chat',
      },
    } as unknown as Message,
    {} as unknown as API,
  );

  assert.equal(processedInputs.length, 3);
  assert.deepEqual(processedInputs[0].triggerPrefixes, ['bot:', '!']);
  assert.equal(processedInputs[2].text, 'BOT: cà phê 30k');
});

void test('ZcaBotFeatureService processes 1-1 User text without @bot or prefix (a private chat already addresses the bot)', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'user-direct-no-mention-test';
  await configService.updateConfig(threadId, {
    threadType: 'user',
    isListened: true,
    directInteraction: {
      enabled: true,
      triggerPrefixes: ['!bot'],
      allowAiChat: true,
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

  // Message "ê bot ơi" has no @bot and does not start with "!bot", but it is a 1-1 chat
  await service.onMessage(
    {
      threadId,
      isSelf: false,
      type: ThreadType.User,
      data: {
        content: 'ê bot ơi',
        uidFrom: 'u123',
        dName: 'User Direct',
        msgType: 'chat',
      },
    } as unknown as Message,
    {} as unknown as API,
  );

  assert.ok(processedInput, 'Text in a 1-1 chat with the bot must be processed');
});

void test('ZcaBotFeatureService processes 1-1 User message with @bot even when custom triggerPrefix is configured', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'user-direct-at-bot-test';
  await configService.updateConfig(threadId, {
    threadType: 'user',
    isListened: true,
    directInteraction: {
      enabled: true,
      triggerPrefixes: ['!bot'],
      allowAiChat: true,
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

  // Message "@bot xin chào" should trigger because @bot is always supported by default
  await service.onMessage(
    {
      threadId,
      isSelf: false,
      type: ThreadType.User,
      data: {
        content: '@bot xin chào',
        uidFrom: 'u123',
        dName: 'User Direct',
        msgType: 'chat',
      },
    } as unknown as Message,
    {} as unknown as API,
  );

  assert.ok(processedInput, 'Message with @bot in 1-1 chat must be processed');
});

void test('ZcaBotFeatureService processes 1-1 User message with custom triggerPrefix (!bot)', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'user-direct-prefix-test';
  await configService.updateConfig(threadId, {
    threadType: 'user',
    isListened: true,
    directInteraction: {
      enabled: true,
      triggerPrefixes: ['!bot'],
      allowAiChat: true,
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

  // Message "!bot hôm nay chi tiêu 50k" should trigger via prefix
  await service.onMessage(
    {
      threadId,
      isSelf: false,
      type: ThreadType.User,
      data: {
        content: '!bot hôm nay chi tiêu 50k',
        uidFrom: 'u123',
        dName: 'User Direct',
        msgType: 'chat',
      },
    } as unknown as Message,
    {} as unknown as API,
  );

  assert.ok(processedInput, 'Message with !bot prefix in 1-1 chat must be processed');
  assert.deepEqual(processedInput.triggerPrefixes, ['!bot']);
});

void test('ZcaBotFeatureService syncThreadMediaHistory validates login and thread type', async () => {
  const configService = new ThreadConfigService();
  const service = new ZcaBotFeatureService(configService);

  const mockZcaServiceNotLoggedIn = {
    isLoggedIn: () => false,
  } as unknown as ZcaService;

  service.setZcaService(mockZcaServiceNotLoggedIn);

  await assert.rejects(
    async () => {
      await service.syncThreadMediaHistory('thread-123');
    },
    { message: /chưa đăng nhập/ },
  );

  const mockZcaServiceLoggedIn = {
    isLoggedIn: () => true,
  } as unknown as ZcaService;
  service.setZcaService(mockZcaServiceLoggedIn);

  // For 1-1 chat
  await configService.updateConfig('direct-user-1', {
    threadType: 'user',
  });

  const directRes = await service.syncThreadMediaHistory('direct-user-1');
  assert.equal(directRes.scannedCount, 0);
  assert.match(directRes.message, /chỉ hỗ trợ các Nhóm chat/);
});

void test('ZcaBotFeatureService syncThreadMediaHistory scans group media and prevents duplicates', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'group-media-sync-1';
  await configService.updateConfig(threadId, {
    threadType: 'group',
    isListened: true,
    mediaBackup: {
      enabled: true,
      uploadImages: true,
      uploadVideos: true,
    },
  });

  const syncedSet = new Set<string>();
  const mockRedisService = {
    isReady: true,
    sismember: (_key: string, member: string) => Promise.resolve(syncedSet.has(member)),
    sadd: (_key: string, ...members: string[]) => {
      members.forEach((m) => syncedSet.add(m));
      return Promise.resolve(true);
    },
  } as unknown as import('../redis/redis.service').RedisService;

  const uploadedFiles: { id: string; msgId?: string }[] = [];
  const mockMediaStorageService = {
    uploadImage: (
      _sender: string,
      _buf: Buffer,
      _target: unknown,
      options?: { msgId?: string },
    ) => {
      uploadedFiles.push({ id: `img-${uploadedFiles.length + 1}`, msgId: options?.msgId });
      return Promise.resolve({
        drive: {
          fileId: `drive-img-${uploadedFiles.length}`,
          webViewLink: 'https://drive.google.com/img',
        },
      });
    },
    uploadVideo: (
      _sender: string,
      _buf: Buffer,
      _target: unknown,
      options?: { msgId?: string },
    ) => {
      uploadedFiles.push({ id: `vid-${uploadedFiles.length + 1}`, msgId: options?.msgId });
      return Promise.resolve({
        drive: {
          fileId: `drive-vid-${uploadedFiles.length}`,
          webViewLink: 'https://drive.google.com/vid',
        },
      });
    },
  } as unknown as import('../receipt-storage/media-storage.service').MediaStorageService;

  const sampleMessages = [
    {
      data: {
        msgId: 'msg-img-1',
        msgType: 'chat.photo',
        content: JSON.stringify({ href: 'data:image/jpeg;base64,dGVzdA==' }),
        uidFrom: 'u1',
        dName: 'Alice',
      },
    },
    {
      data: {
        msgId: 'msg-text-2',
        msgType: 'chat',
        content: 'Hello World',
        uidFrom: 'u2',
        dName: 'Bob',
      },
    },
    {
      data: {
        msgId: 'msg-vid-3',
        msgType: 'chat.video.msg',
        content: JSON.stringify({ href: 'data:video/mp4;base64,dGVzdA==' }),
        uidFrom: 'u1',
        dName: 'Alice',
      },
    },
  ];

  const mockZcaService = {
    isLoggedIn: () => true,
    getGroupChatHistory: (_groupId: string, _count: number) =>
      Promise.resolve({
        lastActionId: '1',
        lastActionIdOther: '1',
        more: 0,
        groupMsgs: sampleMessages,
      }),
  } as unknown as ZcaService;

  const service = new ZcaBotFeatureService(configService, mockMediaStorageService);
  service.setZcaService(mockZcaService);
  service.setRedisService(mockRedisService);

  // First sync run: should upload 2 media files (1 photo, 1 video)
  const res1 = await service.syncThreadMediaHistory(threadId, { limit: 50 });
  assert.equal(res1.scannedCount, 3);
  assert.equal(res1.foundCount, 2);
  assert.equal(res1.syncedCount, 2);
  assert.equal(res1.skippedCount, 0);
  assert.equal(uploadedFiles.length, 2);
  assert.ok(syncedSet.has('msg-img-1'));
  assert.ok(syncedSet.has('msg-vid-3'));

  // Second sync run: exact same history, all media should be skipped due to deduplication
  const res2 = await service.syncThreadMediaHistory(threadId, { limit: 50 });
  assert.equal(res2.scannedCount, 3);
  assert.equal(res2.foundCount, 2);
  assert.equal(res2.syncedCount, 0);
  assert.equal(res2.skippedCount, 2);
  assert.equal(uploadedFiles.length, 2, 'No new uploads should be performed on duplicate run');
});

void test('ZcaBotFeatureService syncThreadMediaHistory filters messages by timeRange', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'sync-timerange-group';
  await configService.updateConfig(threadId, {
    threadType: 'group',
    isListened: true,
  });

  const uploadedFiles: { id: string; msgId?: string }[] = [];
  const mockMediaStorageService = {
    uploadImage: (
      _sender: string,
      _buf: Buffer,
      _target: unknown,
      options?: { msgId?: string },
    ) => {
      uploadedFiles.push({ id: `img-${uploadedFiles.length + 1}`, msgId: options?.msgId });
      return Promise.resolve({
        drive: {
          fileId: `drive-img-${uploadedFiles.length}`,
          webViewLink: 'https://drive.google.com/img',
        },
      });
    },
  } as unknown as import('../receipt-storage/media-storage.service').MediaStorageService;

  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  const sampleMessages = [
    {
      data: {
        msgId: 'msg-recent',
        msgType: 'chat.photo',
        ts: now - 5 * ONE_DAY, // 5 days ago
        content: JSON.stringify({ href: 'data:image/jpeg;base64,dGVzdA==' }),
        uidFrom: 'u1',
        dName: 'Alice',
      },
    },
    {
      data: {
        msgId: 'msg-old',
        msgType: 'chat.photo',
        ts: now - 45 * ONE_DAY, // 45 days ago (older than 1 month)
        content: JSON.stringify({ href: 'data:image/jpeg;base64,dGVzdA==' }),
        uidFrom: 'u2',
        dName: 'Bob',
      },
    },
  ];

  const mockZcaService = {
    isLoggedIn: () => true,
    getGroupChatHistory: (_groupId: string, _count: number) =>
      Promise.resolve({
        lastActionId: '1',
        lastActionIdOther: '1',
        more: 0,
        groupMsgs: sampleMessages,
      }),
  } as unknown as ZcaService;

  const service = new ZcaBotFeatureService(configService, mockMediaStorageService);
  service.setZcaService(mockZcaService);

  // Sync with 1_month (cutoff is 30 days): msg-old (45 days) must be skipped
  const res = await service.syncThreadMediaHistory(threadId, { timeRange: '1_month' });
  assert.equal(res.scannedCount, 2);
  assert.equal(res.foundCount, 1, 'Only msg-recent within 30 days should be found');
  assert.equal(res.syncedCount, 1);
  assert.equal(uploadedFiles.length, 1);
  assert.equal(uploadedFiles[0].msgId, 'msg-recent');
});

void test('ZcaBotFeatureService syncThreadMediaHistory handles Zalo API 404 gracefully when buffer is empty', async () => {
  const configService = new ThreadConfigService();
  const threadId = '404-group-empty-buffer';
  await configService.updateConfig(threadId, {
    threadType: 'group',
    isListened: true,
  });

  const mockZcaService = {
    isLoggedIn: () => true,
    getGroupChatHistory: () => {
      const err = new Error('Request failed with status code 404');
      (err as { name?: string }).name = 'ZcaApiError';
      throw err;
      return Promise.resolve();
    },
  } as unknown as ZcaService;

  const service = new ZcaBotFeatureService(configService);
  service.setZcaService(mockZcaService);

  const res = await service.syncThreadMediaHistory(threadId);
  assert.equal(res.scannedCount, 0);
  assert.equal(res.foundCount, 0);
  assert.equal(res.syncedCount, 0);
  assert.equal(res.warning, 'zalo_history_api_unavailable');
  assert.match(res.message, /ngưng hỗ trợ API đọc lại lịch sử cũ/);
});

void test('ZcaBotFeatureService syncThreadMediaHistory falls back to buffered messages when Zalo API throws 404', async () => {
  const configService = new ThreadConfigService();
  const threadId = '404-group-with-buffer';
  await configService.updateConfig(threadId, {
    threadType: 'group',
    isListened: true,
    mediaBackup: {
      enabled: true,
      uploadImages: true,
    },
  });

  const uploadedFiles: { id: string; msgId?: string }[] = [];
  const mockMediaStorageService = {
    uploadImage: (
      _sender: string,
      _buf: Buffer,
      _target: unknown,
      options?: { msgId?: string },
    ) => {
      uploadedFiles.push({ id: `img-buf-${uploadedFiles.length + 1}`, msgId: options?.msgId });
      return Promise.resolve({
        drive: {
          fileId: `drive-buf-${uploadedFiles.length}`,
          webViewLink: 'https://drive.google.com/buf',
        },
      });
    },
  } as unknown as import('../receipt-storage/media-storage.service').MediaStorageService;

  const mockZcaService = {
    isLoggedIn: () => true,
    getGroupChatHistory: () => {
      throw new Error('Request failed with status code 404');
      return Promise.resolve();
    },
  } as unknown as ZcaService;

  const service = new ZcaBotFeatureService(configService, mockMediaStorageService);
  service.setZcaService(mockZcaService);

  // Pre-fill buffer with recent messages
  await service.bufferRecentMessage(threadId, {
    threadId,
    type: ThreadType.Group,
    data: {
      msgId: 'buf-img-101',
      msgType: 'chat.photo',
      content: JSON.stringify({ href: 'data:image/jpeg;base64,dGVzdA==' }),
      uidFrom: 'u100',
      dName: 'Thành viên A',
    },
  } as unknown as Message);

  const res = await service.syncThreadMediaHistory(threadId);
  assert.equal(res.scannedCount, 1);
  assert.equal(res.foundCount, 1);
  assert.equal(res.syncedCount, 1);
  assert.equal(res.warning, 'scanned_from_buffer');
  assert.equal(uploadedFiles.length, 1);
  assert.equal(uploadedFiles[0].msgId, 'buf-img-101');
});

void test('ZcaBotFeatureService handles quote-reply to an image with @bot and runs OCR', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'group-quote-ocr-test';
  await configService.updateConfig(threadId, {
    threadType: 'group',
    isListened: true,
    directInteraction: {
      enabled: true,
      allowAiChat: true,
    },
  });

  let processedInput: AgentInput | null = null;
  const mockTextInputService = {
    process: (input: AgentInput) => {
      processedInput = input;
      return Promise.resolve();
    },
  } as unknown as TextInputService;

  const mockOcrService = {
    extractTextFromBuffer: () => Promise.resolve('COFFEE SHOP\nTOTAL: 55000 VND'),
  } as unknown as import('../ocr/ocr.service').OcrService;

  const mockMediaStorageService = {
    uploadBill: () =>
      Promise.resolve({
        drive: { fileId: 'f1', webViewLink: 'https://drive.google.com/bill-123' },
      }),
  } as unknown as import('../receipt-storage/media-storage.service').MediaStorageService;

  const service = new ZcaBotFeatureService(configService, mockMediaStorageService);
  service.setTextInputService(mockTextInputService);
  service.setOcrService(mockOcrService);

  const message = {
    threadId,
    isSelf: false,
    type: ThreadType.Group,
    data: {
      msgId: 'm-quote-1',
      content: '@bot thanh toán hóa đơn này nhé',
      uidFrom: 'u-quote-1',
      dName: 'Văn Đạt',
      msgType: 'chat',
      quote: {
        attach: JSON.stringify({ href: 'data:image/jpeg;base64,dGVzdA==' }),
        cliMsgType: 32,
      },
    },
  } as unknown as Message;

  await service.onMessage(message, {} as unknown as API);

  assert.ok(processedInput, 'TextInputService should be called with extracted OCR data');
  assert.equal(processedInput.type, 'image');
  assert.equal(processedInput.imageUrl, 'https://drive.google.com/bill-123');
  assert.match(processedInput.text || '', /TOTAL: 55000 VND/);
  assert.match(processedInput.text || '', /thanh toán hóa đơn này nhé/);
  assert.equal(processedInput.messageId, 'm-quote-1', 'the current message is kept out of context');
});

// Mirrors the real Zalo quote payload of a photo (cliMsgType 32): the URL lives in nested `params.hd`.
function buildRealPhotoQuote(hdUrl: string): Record<string, unknown> {
  return {
    ownerId: '2099328425338516056',
    cliMsgType: 32,
    msg: '',
    attach: JSON.stringify({
      title: '',
      description: '',
      childnumber: 0,
      action: '',
      params: JSON.stringify({ width: 1408, convertible: 'jxl', hd: hdUrl, height: 768 }),
    }),
  };
}

void test('extractQuotedImageUrl reads nested params.hd of real Zalo photo quotes', () => {
  const hd = 'https://photo-stal-11.zdn.vn/gr/jpg/abc/photo.jpg';
  assert.equal(extractQuotedImageUrl(buildRealPhotoQuote(hd)), hd);
  assert.equal(
    extractQuotedImageUrl({ attach: JSON.stringify({ href: 'https://cdn.example.com/a.jpg' }) }),
    'https://cdn.example.com/a.jpg',
  );
  assert.equal(
    extractQuotedImageUrl({ attach: 'https://cdn.example.com/raw.jpg' }),
    'https://cdn.example.com/raw.jpg',
  );
  assert.equal(extractQuotedImageUrl({ attach: '{"title":"","params":"not-json"}' }), null);
  assert.equal(extractQuotedImageUrl({ msg: 'hello' }), null);
  assert.equal(extractQuotedImageUrl(undefined), null);
});

void test('buildImageOcrPrompt uses neutral framing, clips long OCR and flags unreadable images', () => {
  const prompt = buildImageOcrPrompt(
    'STEAK BIN & PIZZA\n125 Lãnh Binh Thăng',
    'tạo lịch hẹn chiều nay',
  );
  assert.match(prompt, /OCR/);
  assert.match(prompt, /125 Lãnh Binh Thăng/);
  assert.match(prompt, /Yêu cầu của người dùng: tạo lịch hẹn chiều nay/);
  assert.doesNotMatch(prompt, /hóa đơn/);

  assert.match(buildImageOcrPrompt('', 'tạo lịch'), /không đọc được chữ/);
  assert.match(buildImageOcrPrompt('', ''), /Ghi nhận hóa đơn này/);
  assert.ok(buildImageOcrPrompt('x'.repeat(5000), 'a').length < 2200);
});

void test('ZcaBotFeatureService runs OCR on a real-shaped quoted photo and feeds it to the LLM', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'group-real-quote-ocr-test';
  await configService.updateConfig(threadId, {
    threadType: 'group',
    isListened: true,
    directInteraction: { enabled: true, allowAiChat: true },
  });

  let processedInput: AgentInput | null = null;
  let ocrCalls = 0;
  const service = new ZcaBotFeatureService(configService);
  service.setTextInputService({
    process: (input: AgentInput) => {
      processedInput = input;
      return Promise.resolve();
    },
  } as unknown as TextInputService);
  service.setOcrService({
    extractTextFromBuffer: () => {
      ocrCalls += 1;
      return Promise.resolve('STEAK BIN & PIZZA\n125 Lãnh Binh Thăng, Q11\n18:00');
    },
  } as unknown as import('../ocr/ocr.service').OcrService);

  const message = {
    threadId,
    isSelf: false,
    type: ThreadType.Group,
    data: {
      content: '@bot tạo lịch hẹn chiều nay cho a',
      uidFrom: 'u-real-quote',
      dName: 'Văn Đạt',
      msgType: 'webchat',
      quote: buildRealPhotoQuote('data:image/jpeg;base64,dGVzdA=='),
    },
  } as unknown as Message;

  await service.onMessage(message, {} as unknown as API);

  assert.equal(ocrCalls, 1, 'OCR must run for quoted photos');
  assert.ok(processedInput, 'TextInputService should receive the OCR-enriched prompt');
  assert.equal(processedInput.type, 'image');
  assert.match(processedInput.text || '', /125 Lãnh Binh Thăng/);
  assert.match(processedInput.text || '', /tạo lịch hẹn chiều nay/);
});

void test('ZcaBotFeatureService still forwards a quoted photo when OCR finds no text', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'group-real-quote-empty-ocr';
  await configService.updateConfig(threadId, {
    threadType: 'group',
    isListened: true,
    directInteraction: { enabled: true, allowAiChat: true },
  });

  let processedInput: AgentInput | null = null;
  const service = new ZcaBotFeatureService(configService);
  service.setTextInputService({
    process: (input: AgentInput) => {
      processedInput = input;
      return Promise.resolve();
    },
  } as unknown as TextInputService);
  service.setOcrService({
    extractTextFromBuffer: () => Promise.resolve(''),
  } as unknown as import('../ocr/ocr.service').OcrService);

  await service.onMessage(
    {
      threadId,
      isSelf: false,
      type: ThreadType.Group,
      data: {
        content: '@bot tạo lịch từ ảnh này',
        uidFrom: 'u-real-quote-2',
        dName: 'Văn Đạt',
        msgType: 'webchat',
        quote: buildRealPhotoQuote('data:image/jpeg;base64,dGVzdA=='),
      },
    } as unknown as Message,
    {} as unknown as API,
  );

  assert.ok(processedInput);
  assert.match(processedInput.text || '', /không đọc được chữ/);
  assert.match(processedInput.text || '', /tạo lịch từ ảnh này/);
});

void test('isStorageUploadInstruction detects storage upload intents and distinguishes from bills', () => {
  assert.equal(isStorageUploadInstruction('lưu ảnh này lên drive'), true);
  assert.equal(isStorageUploadInstruction('lưu ảnh này lên drive nhé'), true);
  assert.equal(isStorageUploadInstruction('lưu ảnh lên drive'), true);
  assert.equal(isStorageUploadInstruction('lưu lên drive'), true);
  assert.equal(isStorageUploadInstruction('lưu vào drive'), true);
  assert.equal(isStorageUploadInstruction('lưu ảnh'), true);
  assert.equal(isStorageUploadInstruction('lưu drive'), true);
  assert.equal(isStorageUploadInstruction('lưu kho'), true);
  assert.equal(isStorageUploadInstruction('2'), true);
  assert.equal(isStorageUploadInstruction('2 lưu vào drive'), true);
  assert.equal(isStorageUploadInstruction('upload lên drive'), true);
  assert.equal(isStorageUploadInstruction('up ảnh này lên drive'), true);
  assert.equal(isStorageUploadInstruction('lưu video này lên drive'), true);

  // Negative cases: bills and general chatter
  assert.equal(isStorageUploadInstruction('lưu hóa đơn này'), false);
  assert.equal(isStorageUploadInstruction('tạo hóa đơn này'), false);
  assert.equal(isStorageUploadInstruction('lưu bill ăn trưa'), false);
  assert.equal(isStorageUploadInstruction('ăn trưa 45k'), false);
  assert.equal(isStorageUploadInstruction('mai 9h họp'), false);
  assert.equal(isStorageUploadInstruction(''), false);
});

void test('ZcaBotFeatureService handles quote-reply to an image with @bot lưu ảnh này lên drive and saves to Drive/Photos', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'group-quote-drive-test';
  await configService.updateConfig(threadId, {
    threadType: 'group',
    isListened: true,
    directInteraction: {
      enabled: true,
    },
  });

  const sentReplies: string[] = [];
  const mockApi = {
    sendMessage: (msg: string | { msg: string }) => {
      sentReplies.push(typeof msg === 'string' ? msg : msg.msg);
      return Promise.resolve({ message: { msgId: 21 }, attachment: [] });
    },
  } as unknown as API;

  let uploadImageCalled = false;
  let uploadBillCalled = false;
  const mockMediaStorageService = {
    uploadImage: () => {
      uploadImageCalled = true;
      return Promise.resolve({
        drive: {
          fileId: 'img-file-1',
          webViewLink: 'https://drive.google.com/img-file-1',
          folderPath: 'zalobot/img',
        },
        photos: {
          albumTitle: '[Zalo] Nhóm group-quote-drive-test',
          productUrl: 'https://photos.google.com/album-1',
        },
      });
    },
    uploadBill: () => {
      uploadBillCalled = true;
      return Promise.resolve({});
    },
    formatUploadSummary: (res: {
      drive?: { webViewLink?: string };
      photos?: { productUrl?: string };
    }) =>
      `☁️ ĐÃ LƯU TRỮ HÌNH ẢNH LÊN GOOGLE:\n📁 Google Drive: ${res.drive?.webViewLink}\n📸 Google Photos: ${res.photos?.productUrl}`,
  } as unknown as import('../receipt-storage/media-storage.service').MediaStorageService;

  let textInputCalled = false;
  const mockTextInputService = {
    process: () => {
      textInputCalled = true;
      return Promise.resolve();
    },
  } as unknown as TextInputService;

  const service = new ZcaBotFeatureService(configService, mockMediaStorageService);
  service.setTextInputService(mockTextInputService);

  const message = {
    threadId,
    isSelf: false,
    type: ThreadType.Group,
    data: {
      content: '@bot lưu ảnh này lên drive nhé',
      uidFrom: 'u-user-drive',
      dName: 'Anh Tuấn',
      msgType: 'chat',
      quote: {
        attach: JSON.stringify({ href: 'data:image/jpeg;base64,dGVzdA==' }),
        cliMsgType: 32,
      },
    },
  } as unknown as Message;

  await service.onMessage(message, mockApi);

  assert.equal(uploadImageCalled, true, 'uploadImage must be called');
  assert.equal(uploadBillCalled, false, 'uploadBill must NOT be called');
  assert.equal(textInputCalled, false, 'textInputService must NOT be called for storage upload');
  assert.equal(sentReplies.length, 2, 'Should send loading progress and formatted summary');
  assert.match(sentReplies[0], /Đang tải ảnh lên Google Drive/);
  assert.match(sentReplies[1], /https:\/\/drive\.google\.com\/img-file-1/);
  assert.match(sentReplies[1], /https:\/\/photos\.google\.com\/album-1/);
});

void test('ZcaBotFeatureService handles direct image with caption @bot lưu ảnh này lên drive and saves to Drive/Photos', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'group-direct-drive-test';
  await configService.updateConfig(threadId, {
    threadType: 'group',
    isListened: true,
    directInteraction: {
      enabled: true,
    },
  });

  const sentReplies: string[] = [];
  const mockApi = {
    sendMessage: (msg: string | { msg: string }) => {
      sentReplies.push(typeof msg === 'string' ? msg : msg.msg);
      return Promise.resolve({ message: { msgId: 22 }, attachment: [] });
    },
  } as unknown as API;

  let uploadImageCalled = false;
  let uploadBillCalled = false;
  const mockMediaStorageService = {
    uploadImage: () => {
      uploadImageCalled = true;
      return Promise.resolve({
        drive: { fileId: 'img-direct-1', webViewLink: 'https://drive.google.com/img-direct-1' },
        photos: { albumTitle: 'Album Direct', productUrl: 'https://photos.google.com/direct-1' },
      });
    },
    uploadBill: () => {
      uploadBillCalled = true;
      return Promise.resolve({});
    },
    formatUploadSummary: (res: {
      drive?: { webViewLink?: string };
      photos?: { productUrl?: string };
    }) => `☁️ ĐÃ LƯU TRỮ HÌNH ẢNH LÊN GOOGLE:\n📁 Google Drive: ${res.drive?.webViewLink}`,
  } as unknown as import('../receipt-storage/media-storage.service').MediaStorageService;

  let textInputCalled = false;
  const mockTextInputService = {
    process: () => {
      textInputCalled = true;
      return Promise.resolve();
    },
  } as unknown as TextInputService;

  const service = new ZcaBotFeatureService(configService, mockMediaStorageService);
  service.setTextInputService(mockTextInputService);

  const message = {
    threadId,
    isSelf: false,
    type: ThreadType.Group,
    data: {
      content: JSON.stringify({
        href: 'data:image/jpeg;base64,dGVzdA==',
        title: '@bot lưu ảnh này lên drive',
      }),
      uidFrom: 'u-user-direct',
      dName: 'Chị Mai',
      msgType: 'chat.photo',
    },
  } as unknown as Message;

  await service.onMessage(message, mockApi);

  assert.equal(uploadImageCalled, true, 'uploadImage must be called');
  assert.equal(uploadBillCalled, false, 'uploadBill must NOT be called');
  assert.equal(textInputCalled, false, 'textInputService must NOT be called');
  assert.equal(sentReplies.length, 2);
  assert.match(sentReplies[1], /https:\/\/drive\.google\.com\/img-direct-1/);
});

void test('ZcaBotFeatureService in 1-1 chat without caption only stores the photo (no menu, no OCR)', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'direct-batch-test';
  await configService.updateConfig(threadId, {
    threadType: 'user',
    isListened: true,
  });

  let batchHandledInput: AgentInput | null = null;
  let batchHandledChatId = '';
  const mockImageBatchHandler = {
    handle: (input: AgentInput, chatId: string) => {
      batchHandledInput = input;
      batchHandledChatId = chatId;
      return Promise.resolve();
    },
    onModuleDestroy: () => {},
  } as unknown as import('./pending-image/image-batch-handler.service').ImageBatchHandler;

  const service = new ZcaBotFeatureService(configService);
  service.setImageBatchHandler(mockImageBatchHandler);

  const message = {
    threadId,
    isSelf: false,
    type: ThreadType.User,
    data: {
      content: JSON.stringify({ href: 'https://example.com/bill.jpg' }),
      uidFrom: 'u-batch-1',
      dName: 'Alice',
      msgType: 'chat.photo',
    },
  } as unknown as Message;

  await service.onMessage(message, {} as unknown as API);

  assert.equal(batchHandledInput, null, 'A photo without text must not open the image menu');
  assert.equal(batchHandledChatId, '');
});

void test('ZcaBotFeatureService in group without @bot does silent backup only and no interactive prompt', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'group-silent-photo-test';
  await configService.updateConfig(threadId, {
    threadType: 'group',
    isListened: true,
    mediaBackup: {
      enabled: true,
      uploadImages: true,
    },
    directInteraction: {
      enabled: true,
    },
  });

  let imageUploaded = false;
  const mockMediaStorageService = {
    uploadImage: () => {
      imageUploaded = true;
      return Promise.resolve({ drive: { fileId: 'backup-123' } });
    },
  } as unknown as import('../receipt-storage/media-storage.service').MediaStorageService;

  let textInputCalled = false;
  const mockTextInputService = {
    process: () => {
      textInputCalled = true;
      return Promise.resolve();
    },
  } as unknown as TextInputService;

  let batchHandlerCalled = false;
  const mockImageBatchHandler = {
    handle: () => {
      batchHandlerCalled = true;
      return Promise.resolve();
    },
  } as unknown as import('./pending-image/image-batch-handler.service').ImageBatchHandler;

  const service = new ZcaBotFeatureService(configService, mockMediaStorageService);
  service.setTextInputService(mockTextInputService);
  service.setImageBatchHandler(mockImageBatchHandler);

  const message = {
    threadId,
    isSelf: false,
    type: ThreadType.Group,
    data: {
      content: JSON.stringify({ href: 'data:image/jpeg;base64,dGVzdA==' }),
      uidFrom: 'u-meme-1',
      dName: 'Bob',
      msgType: 'chat.photo',
    },
  } as unknown as Message;

  await service.onMessage(message, {} as unknown as API);

  assert.equal(imageUploaded, true, 'Image should be backed up silently');
  assert.equal(
    textInputCalled,
    false,
    'TextInputService should not be called for casual group image',
  );
  assert.equal(
    batchHandlerCalled,
    false,
    'ImageBatchHandler must not be called in group to avoid spam',
  );
});

void test('ZcaBotFeatureService handles direct video upload when tagged @bot', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'group-video-direct-test';
  await configService.updateConfig(threadId, {
    threadType: 'group',
    isListened: true,
    directInteraction: {
      enabled: true,
    },
  });

  let videoUploaded = false;
  const mockMediaStorageService = {
    uploadVideo: () => {
      videoUploaded = true;
      return Promise.resolve({ drive: { fileId: 'vid-file-1' } });
    },
    formatUploadSummary: () => '✅ Đã lưu trữ video thành công!',
  } as unknown as import('../receipt-storage/media-storage.service').MediaStorageService;

  const sentMessages: string[] = [];
  const mockApi = {
    sendMessage: (msg: string | { msg: string }) => {
      sentMessages.push(typeof msg === 'string' ? msg : msg.msg);
      return Promise.resolve({ message: { msgId: 10 }, attachment: [] });
    },
  } as unknown as API;

  const service = new ZcaBotFeatureService(configService, mockMediaStorageService);

  const message = {
    threadId,
    isSelf: false,
    type: ThreadType.Group,
    data: {
      content: JSON.stringify({ href: 'data:video/mp4;base64,dGVzdA==' }),
      uidFrom: 'u-vid-1',
      dName: 'Charlie',
      msgType: 'chat.video.msg',
    },
  } as unknown as Message;

  // With @bot in group
  await service.onMessage(
    {
      ...message,
      data: {
        ...message.data,
        content: JSON.stringify({
          href: 'data:video/mp4;base64,dGVzdA==',
          title: '@bot lưu video này',
        }),
      },
    } as unknown as Message,
    mockApi,
  );

  assert.equal(videoUploaded, true, 'Video upload should be executed');
  assert.ok(sentMessages.some((msg) => msg.includes('Đã lưu trữ video')));
});

void test('ZcaBotFeatureService blocks direct interaction if GrantAccessGuard denies', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'group-guard-test';
  await configService.updateConfig(threadId, {
    threadType: 'group',
    isListened: true,
    directInteraction: {
      enabled: true,
    },
  });

  const mockGrantAccessGuard = {
    canActivate: () => Promise.resolve(false), // Access denied
  } as unknown as import('./guards/grant-access.guard').GrantAccessGuard;

  let textInputCalled = false;
  const mockTextInputService = {
    process: () => {
      textInputCalled = true;
      return Promise.resolve();
    },
  } as unknown as TextInputService;

  const service = new ZcaBotFeatureService(configService);
  service.setGrantAccessGuard(mockGrantAccessGuard);
  service.setTextInputService(mockTextInputService);

  const message = {
    threadId,
    isSelf: false,
    type: ThreadType.Group,
    data: {
      content: '@bot ăn trưa 50k',
      uidFrom: 'unauthorized-user',
      dName: 'Hacker',
      msgType: 'chat',
    },
  } as unknown as Message;

  await service.onMessage(message, {} as unknown as API);
  assert.equal(textInputCalled, false, 'TextInputService should be blocked by GrantAccessGuard');
});

void test('ZcaBotFeatureService rate limits via UsersService.checkCooldown', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'cooldown-test';
  await configService.updateConfig(threadId, {
    threadType: 'group',
    isListened: true,
    directInteraction: {
      enabled: true,
    },
  });

  const sentReplies: string[] = [];
  const mockApi = {
    sendMessage: (msg: string | { msg: string }) => {
      sentReplies.push(typeof msg === 'string' ? msg : msg.msg);
      return Promise.resolve({ message: { msgId: 11 }, attachment: [] });
    },
  } as unknown as API;

  const mockUsersService = {
    checkCooldown: () => ({ allowed: false, reason: '⏳ Bạn gửi quá nhanh, vui lòng chờ 3s.' }),
  } as unknown as import('../users/users.service').UsersService;

  let textInputCalled = false;
  const mockTextInputService = {
    process: () => {
      textInputCalled = true;
      return Promise.resolve();
    },
  } as unknown as TextInputService;

  const service = new ZcaBotFeatureService(configService);
  service.setUsersService(mockUsersService);
  service.setTextInputService(mockTextInputService);

  const message = {
    threadId,
    isSelf: false,
    type: ThreadType.Group,
    data: {
      content: '@bot /ping',
      uidFrom: 'spammy-user',
      dName: 'Spammer',
      msgType: 'chat',
    },
  } as unknown as Message;

  await service.onMessage(message, mockApi);

  assert.equal(textInputCalled, false);
  assert.equal(sentReplies.length, 1);
  assert.match(sentReplies[0], /Bạn gửi quá nhanh/);
});

void test('ZcaBotFeatureService dispatches pending image selections ("1", "2", "hủy")', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'pending-dispatcher-test';
  await configService.updateConfig(threadId, {
    threadType: 'user',
    isListened: true,
  });

  let dispatchedText = '';
  const mockPendingImageDispatcher = {
    dispatch: (_input: AgentInput, _sender: string, _chat: string, _name: string, text: string) => {
      dispatchedText = text;
      return Promise.resolve(true); // Handled
    },
  } as unknown as import('./pending-image/pending-image-dispatcher.service').PendingImageActionDispatcher;

  let textInputCalled = false;
  const mockTextInputService = {
    process: () => {
      textInputCalled = true;
      return Promise.resolve();
    },
  } as unknown as TextInputService;

  const service = new ZcaBotFeatureService(configService);
  service.setPendingImageDispatcher(mockPendingImageDispatcher);
  service.setTextInputService(mockTextInputService);

  const message = {
    threadId,
    isSelf: false,
    type: ThreadType.User,
    data: {
      content: '1 Ăn trưa Highlands',
      uidFrom: 'u-pending-1',
      dName: 'Dave',
      msgType: 'chat',
    },
  } as unknown as Message;

  await service.onMessage(message, {} as unknown as API);

  assert.equal(dispatchedText, '1 Ăn trưa Highlands');
  assert.equal(
    textInputCalled,
    false,
    'TextInputService should not be called when pending dispatcher handles it',
  );
});

async function createGroupScenario(options: { threadId: string; granted: string[] }) {
  const configService = new ThreadConfigService();
  await configService.updateConfig(options.threadId, {
    threadType: 'group',
    isListened: true,
    directInteraction: { enabled: true, triggerPrefixes: ['!'], allowAiChat: true },
  });

  const processed: AgentInput[] = [];
  const mockTextInputService = {
    process: (input: AgentInput) => {
      processed.push(input);
      return Promise.resolve();
    },
  } as unknown as TextInputService;

  const sent: string[] = [];
  const mockApi = {
    sendMessage: (msg: string | { msg: string }) => {
      sent.push(typeof msg === 'string' ? msg : msg.msg);
      return Promise.resolve({ message: { msgId: 1 }, attachment: [] });
    },
  } as unknown as API;

  const usersService = createUsersServiceMock({ granted: options.granted });
  const service = new ZcaBotFeatureService(configService);
  service.setTextInputService(mockTextInputService);
  service.setUsersService(usersService);

  const send = (uidFrom: string, content: string) =>
    service.onMessage(
      {
        threadId: options.threadId,
        isSelf: false,
        type: ThreadType.Group,
        data: { content, uidFrom, dName: 'Member', msgType: 'chat' },
      } as unknown as Message,
      mockApi,
    );

  return { processed, sent, usersService, send };
}

void test('ZcaBotFeatureService ignores un-addressed group text from a granted member without any reaction', async () => {
  const scenario = await createGroupScenario({
    threadId: 'group-unaddressed-granted',
    granted: ['member-1'],
  });

  await scenario.send('member-1', 'ăn trưa 45k');
  await scenario.send('member-1', 'mai 9h họp');

  assert.equal(scenario.processed.length, 0, 'TextInputService must not be called');
  assert.equal(scenario.sent.length, 0, 'Bot must not reply');
  assert.deepEqual(scenario.usersService.registered, [], 'Must not register pending user');
});

void test('ZcaBotFeatureService forwards group text from a granted member once it uses a prefix', async () => {
  const scenario = await createGroupScenario({
    threadId: 'group-prefixed-granted',
    granted: ['member-1'],
  });

  await scenario.send('member-1', '!ăn trưa 45k');

  assert.equal(scenario.processed.length, 1);
  assert.equal(scenario.processed[0].text, '!ăn trưa 45k');
});

void test('ZcaBotFeatureService backs up group media of non-granted members (L3)', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'group-media-non-granted';
  await configService.updateConfig(threadId, {
    threadType: 'group',
    isListened: true,
    mediaBackup: { enabled: true, uploadImages: true },
  });

  let imageUploaded = false;
  const mockMediaStorageService = {
    uploadImage: () => {
      imageUploaded = true;
      return Promise.resolve({ drive: { fileId: 'backup-1' } });
    },
  } as unknown as import('../receipt-storage/media-storage.service').MediaStorageService;

  const service = new ZcaBotFeatureService(configService, mockMediaStorageService);
  service.setUsersService(createUsersServiceMock({ granted: [] }));

  await service.onMessage(
    {
      threadId,
      isSelf: false,
      type: ThreadType.Group,
      data: {
        content: JSON.stringify({ href: 'data:image/jpeg;base64,dGVzdA==' }),
        uidFrom: 'stranger-1',
        dName: 'Stranger',
        msgType: 'chat.photo',
      },
    } as unknown as Message,
    {} as unknown as API,
  );

  assert.equal(imageUploaded, true);
});

void test('ZcaBotFeatureService only lets pending owner or granted users edit a pending action', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'group-edit-gate';
  await configService.updateConfig(threadId, { threadType: 'group', isListened: true });

  const canEditCalls: Array<(pending: { userId: string }) => Promise<boolean>> = [];
  const mockConfirmationService = {
    handleReaction: () => Promise.resolve({ handled: false }),
    handleCommand: (
      _senderId: string,
      _chatId: string,
      _text: string,
      _onEdit?: unknown,
      canEdit?: (pending: { userId: string }) => Promise<boolean>,
    ) => {
      if (canEdit) canEditCalls.push(canEdit);
      return Promise.resolve(true);
    },
  } as unknown as TransactionConfirmationService;

  const service = new ZcaBotFeatureService(configService, mockConfirmationService);
  service.setUsersService(createUsersServiceMock({ granted: ['granted-1'] }));

  const send = (uidFrom: string) =>
    service.onMessage(
      {
        threadId,
        isSelf: false,
        type: ThreadType.Group,
        data: { content: 'edit 123 cho link drive', uidFrom, dName: 'X', msgType: 'chat' },
      } as unknown as Message,
      {} as unknown as API,
    );

  await send('stranger-1');
  await send('granted-1');
  await send('owner-1');

  const pending = { userId: 'owner-1' };
  assert.equal(canEditCalls.length, 3);
  assert.equal(await canEditCalls[0](pending), false, 'non-granted stranger must be rejected');
  assert.equal(await canEditCalls[1](pending), true, 'granted member may edit');
  assert.equal(await canEditCalls[2](pending), true, 'pending owner may edit');
});

function createNumericGroupMessage(threadId: string): Message {
  return {
    threadId,
    isSelf: false,
    type: ThreadType.Group,
    data: { content: 'Hello', uidFrom: 'u1', msgType: 'chat' },
  } as unknown as Message;
}

void test('ZcaBotFeatureService.onMessage stores a numeric ZCA group id as group', async () => {
  const configService = new ThreadConfigService();
  const service = new ZcaBotFeatureService(configService);
  const threadId = '7120342145544273834';

  await service.onMessage(createNumericGroupMessage(threadId), {} as unknown as API);

  assert.equal(configService.getConfigSync(threadId)?.threadType, 'group');
  assert.equal(await configService.isGroupThread(threadId), true);
});

void test('ZcaBotFeatureService.onMessage corrects a group config stored as user', async () => {
  const configService = new ThreadConfigService();
  const threadId = '7120342145544273835';
  await configService.updateConfig(threadId, { threadType: 'user', isListened: false });
  assert.equal(await configService.isGroupThread(threadId), false);

  const service = new ZcaBotFeatureService(configService);
  await service.onMessage(createNumericGroupMessage(threadId), {} as unknown as API);

  assert.equal(configService.getConfigSync(threadId)?.threadType, 'group');
  assert.equal(await configService.isGroupThread(threadId), true);
});

void test('ZcaBotFeatureService.onReaction stores a numeric ZCA group id as group', async () => {
  const configService = new ThreadConfigService();
  const service = new ZcaBotFeatureService(configService);
  const threadId = '7120342145544273836';
  const reaction = {
    threadId,
    isSelf: false,
    isGroup: true,
    data: { uidFrom: 'u1', content: { rIcon: '/-heart', rMsg: [] } },
  } as unknown as Reaction;

  await service.onReaction(reaction, {} as unknown as API);

  assert.equal(configService.getConfigSync(threadId)?.threadType, 'group');
});

void test('ZcaBotFeatureService media sync keeps the channel Drive link on the channel root', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'group-drive-root-1';
  await configService.updateConfig(threadId, {
    threadType: 'group',
    isListened: true,
    mediaBackup: { enabled: true, uploadImages: true },
  });
  await configService.saveDriveFolderInfo(threadId, {
    folderUrl: 'https://drive.google.com/drive/folders/root',
    folderPath: `zalobot/${threadId}`,
  });

  const mockMediaStorageService = {
    uploadImage: () =>
      Promise.resolve({
        drive: {
          fileId: 'drive-img-1',
          folderId: 'month-folder',
          folderPath: `zalobot/${threadId}/image/2026-10`,
          webViewLink: 'https://drive.google.com/img',
        },
      }),
  } as unknown as import('../receipt-storage/media-storage.service').MediaStorageService;

  const mockZcaService = {
    isLoggedIn: () => true,
    getGroupChatHistory: () =>
      Promise.resolve({
        lastActionId: '1',
        lastActionIdOther: '1',
        more: 0,
        groupMsgs: [
          {
            data: {
              msgId: 'msg-img-root',
              msgType: 'chat.photo',
              content: JSON.stringify({ href: 'data:image/jpeg;base64,dGVzdA==' }),
              uidFrom: 'u1',
              dName: 'Alice',
            },
          },
        ],
      }),
  } as unknown as ZcaService;

  const service = new ZcaBotFeatureService(configService, mockMediaStorageService);
  service.setZcaService(mockZcaService);

  const res = await service.syncThreadMediaHistory(threadId, { limit: 50 });
  assert.equal(res.syncedCount, 1);
  const config = configService.getConfigSync(threadId);
  assert.equal(config?.driveFolderUrl, 'https://drive.google.com/drive/folders/root');
  assert.equal(config?.driveFolderPath, `zalobot/${threadId}`);
});

interface RecordedMemoryCall {
  method: 'record' | 'markRecalled';
  args: unknown[];
}

function createChatMemoryMock(calls: RecordedMemoryCall[]): ChatMemoryService {
  return {
    record: (...args: unknown[]) => {
      calls.push({ method: 'record', args });
      return Promise.resolve();
    },
    markRecalled: (...args: unknown[]) => {
      calls.push({ method: 'markRecalled', args });
      return Promise.resolve();
    },
  } as unknown as ChatMemoryService;
}

function createServiceWithMemory(
  configService: ThreadConfigService,
  memory: ChatMemoryService,
  shortTermMemory?: ShortTermMemoryService,
  imageTextMemory?: ImageTextMemoryService,
): ZcaBotFeatureService {
  return new ZcaBotFeatureService(
    configService,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    memory,
    undefined,
    shortTermMemory,
    imageTextMemory,
  );
}

/** Records queued photos; `recognizeNow` answers with a fixed text, as if it read the photo. */
function createImageTextMemoryMock(text = 'CƠM GÀ 45.000'): {
  memory: ImageTextMemoryService;
  jobs: ImageTextJob[];
  asked: Array<string | undefined>;
} {
  const jobs: ImageTextJob[] = [];
  const asked: Array<string | undefined> = [];
  const memory = {
    enqueue: (job: ImageTextJob) => {
      jobs.push(job);
    },
    recognizeNow: (_channelId: string, msgId: string | undefined) => {
      asked.push(msgId);
      return Promise.resolve(text);
    },
  } as unknown as ImageTextMemoryService;
  return { memory, jobs, asked };
}

function photoMessage(threadId: string, type: ThreadType, msgId: string, caption = ''): Message {
  return {
    threadId,
    isSelf: false,
    type,
    data: {
      msgId,
      content: { href: 'data:image/jpeg;base64,dGVzdA==', title: caption },
      uidFrom: 'owner',
      dName: 'Nam',
      msgType: 'chat.photo',
    },
  } as unknown as Message;
}

void test('ZcaBotFeatureService stores every message of a listened thread in chat memory', async () => {
  const configService = new ThreadConfigService();
  const threadId = `memory-thread-${Date.now()}`;
  await configService.updateConfig(threadId, {
    isListened: true,
    chatMemory: { enabled: true, contextWindow: 5, searchLimit: 20 },
  });
  const calls: RecordedMemoryCall[] = [];
  const service = createServiceWithMemory(configService, createChatMemoryMock(calls));

  const message = {
    threadId,
    isSelf: false,
    type: ThreadType.Group,
    data: { msgId: '7001', content: 'mai đi Vũng Tàu', uidFrom: 'u1', msgType: 'webchat' },
  } as unknown as Message;
  await service.onMessage(message, {} as unknown as API);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'record');
  assert.equal(calls[0].args[0], threadId);
  assert.equal(calls[0].args[1], 'group');
});

void test('ZcaBotFeatureService does not store messages of unlistened threads', async () => {
  const configService = new ThreadConfigService();
  const calls: RecordedMemoryCall[] = [];
  const service = createServiceWithMemory(configService, createChatMemoryMock(calls));

  const message = {
    threadId: `memory-unlistened-${Date.now()}`,
    isSelf: false,
    type: ThreadType.Group,
    data: { msgId: '1', content: 'secret', uidFrom: 'u1', msgType: 'webchat' },
  } as unknown as Message;
  await service.onMessage(message, {} as unknown as API);

  assert.equal(calls.length, 0);
});

void test('ZcaBotFeatureService forgets a recalled message', async () => {
  const configService = new ThreadConfigService();
  const calls: RecordedMemoryCall[] = [];
  const service = createServiceWithMemory(configService, createChatMemoryMock(calls));

  const undo = {
    threadId: 'g-recall',
    isSelf: false,
    isGroup: true,
    data: { uidFrom: 'u-9', content: { globalMsgId: 7001, cliMsgId: 55 } },
  } as unknown as Undo;
  await service.onUndo(undo);

  assert.deepEqual(calls, [
    {
      method: 'markRecalled',
      args: ['g-recall', '7001', { cliMsgId: '55', senderUid: 'u-9' }],
    },
  ]);
});

void test('ZcaBotFeatureService does not store messages of a listened thread with memory off', async () => {
  const configService = new ThreadConfigService();
  const threadId = `memory-off-${Date.now()}`;
  await configService.updateConfig(threadId, {
    isListened: true,
    directInteraction: { enabled: true, allowAiChat: true },
  });
  const calls: RecordedMemoryCall[] = [];
  const seen: { input?: AgentInput } = {};
  const service = createServiceWithMemory(configService, createChatMemoryMock(calls));
  service.setTextInputService({
    process: (input: AgentInput) => {
      seen.input = input;
      return Promise.resolve();
    },
  } as unknown as TextInputService);

  const message = {
    threadId,
    isSelf: false,
    type: ThreadType.User,
    data: { msgId: '9', content: 'hôm qua mình nói gì', uidFrom: 'owner', msgType: 'webchat' },
  } as unknown as Message;
  await service.onMessage(message, { getOwnId: () => 'bot-id' } as unknown as API);

  assert.equal(calls.length, 0);
  assert.ok(seen.input, 'the text still reaches the bot');
  assert.equal(seen.input.shortTermMemory, undefined);
  assert.equal(seen.input.longTermMemory, undefined);
});

void test('ZcaBotFeatureService passes the thread memory settings to the text pipeline', async () => {
  const configService = new ThreadConfigService();
  const threadId = `memory-on-input-${Date.now()}`;
  await configService.updateConfig(threadId, {
    isListened: true,
    directInteraction: { enabled: true, allowAiChat: true },
    chatMemory: { enabled: true, shortTermEnabled: true, contextWindow: 4, searchLimit: 9 },
  });
  const seen: { input?: AgentInput } = {};
  const service = createServiceWithMemory(configService, createChatMemoryMock([]));
  service.setTextInputService({
    process: (input: AgentInput) => {
      seen.input = input;
      return Promise.resolve();
    },
  } as unknown as TextInputService);

  const message = {
    threadId,
    isSelf: false,
    type: ThreadType.User,
    data: {
      msgId: '10',
      content: 'tuần trước ai bảo mua vé',
      uidFrom: 'owner',
      msgType: 'webchat',
    },
  } as unknown as Message;
  await service.onMessage(message, { getOwnId: () => 'bot-id' } as unknown as API);

  assert.deepEqual(seen.input?.shortTermMemory, { contextWindow: 4, days: 1 });
  assert.deepEqual(seen.input?.longTermMemory, { searchLimit: 9 });
});

void test('ZcaBotFeatureService keeps the short-term memory when the long-term memory is off', async () => {
  const configService = new ThreadConfigService();
  const threadId = `memory-short-only-${Date.now()}`;
  await configService.updateConfig(threadId, {
    isListened: true,
    directInteraction: { enabled: true, allowAiChat: true },
    chatMemory: { enabled: false, shortTermEnabled: true, contextWindow: 6, shortTermDays: 3 },
  });
  const calls: RecordedMemoryCall[] = [];
  const shortTermMemory = new ShortTermMemoryService();
  const seen: { input?: AgentInput } = {};
  const service = createServiceWithMemory(
    configService,
    createChatMemoryMock(calls),
    shortTermMemory,
  );
  service.setTextInputService({
    process: (input: AgentInput) => {
      seen.input = input;
      return Promise.resolve();
    },
  } as unknown as TextInputService);

  const message = {
    threadId,
    isSelf: false,
    type: ThreadType.User,
    data: { msgId: '11', content: 'ăn trưa 45k', uidFrom: 'owner', msgType: 'webchat' },
  } as unknown as Message;
  await service.onMessage(message, { getOwnId: () => 'bot-id' } as unknown as API);

  assert.equal(calls.length, 0, 'nothing is stored in Postgres');
  assert.deepEqual(seen.input?.shortTermMemory, { contextWindow: 6, days: 3 });
  assert.equal(seen.input?.longTermMemory, undefined);
  assert.deepEqual(
    (await shortTermMemory.getRecent(threadId, { limit: 10, maxAgeDays: 3 })).map(
      (line) => line.text,
    ),
    ['ăn trưa 45k'],
  );

  // A recall reaches the short-term memory too.
  await service.onUndo({
    threadId,
    isSelf: false,
    isGroup: false,
    data: { uidFrom: 'owner', content: { globalMsgId: 11, cliMsgId: 0 } },
  } as unknown as Undo);
  assert.deepEqual(await shortTermMemory.getRecent(threadId, { limit: 10, maxAgeDays: 3 }), []);
});

void test('ZcaBotFeatureService queues every photo of a chat with memory on for its text', async () => {
  const configService = new ThreadConfigService();
  const threadId = `memory-photo-${Date.now()}`;
  await configService.updateConfig(threadId, {
    isListened: true,
    chatMemory: { enabled: true, shortTermEnabled: true, shortTermDays: 2 },
  });
  const imageText = createImageTextMemoryMock();
  const service = createServiceWithMemory(
    configService,
    createChatMemoryMock([]),
    undefined,
    imageText.memory,
  );

  // A group photo that does not address the bot is still read for the memory.
  await service.onMessage(photoMessage(threadId, ThreadType.Group, '501', 'menu trưa'), {
    getOwnId: () => 'bot-id',
  } as unknown as API);

  assert.equal(imageText.jobs.length, 1);
  const [job] = imageText.jobs;
  assert.equal(job.channelId, threadId);
  assert.equal(job.channelType, 'group');
  assert.equal(job.imageUrl, 'data:image/jpeg;base64,dGVzdA==');
  assert.equal(job.longTerm, true);
  assert.equal(job.shortTermDays, 2);
  assert.ok(job.afterStored, 'waits for the long-term row');
});

void test('ZcaBotFeatureService does not read photos when the switch or every memory is off', async () => {
  const configService = new ThreadConfigService();
  const switchOff = `memory-photo-switch-off-${Date.now()}`;
  const memoryOff = `memory-photo-memory-off-${Date.now()}`;
  await configService.updateConfig(switchOff, {
    isListened: true,
    chatMemory: { enabled: true, readImageText: false },
  });
  await configService.updateConfig(memoryOff, { isListened: true });
  const imageText = createImageTextMemoryMock();
  const service = createServiceWithMemory(
    configService,
    createChatMemoryMock([]),
    undefined,
    imageText.memory,
  );

  const api = { getOwnId: () => 'bot-id' } as unknown as API;
  await service.onMessage(photoMessage(switchOff, ThreadType.Group, '601'), api);
  await service.onMessage(photoMessage(memoryOff, ThreadType.Group, '602'), api);

  assert.equal(imageText.jobs.length, 0);
});

void test('ZcaBotFeatureService reads a photo that asks the bot once, through the memory reader', async () => {
  const configService = new ThreadConfigService();
  const threadId = `memory-photo-direct-${Date.now()}`;
  await configService.updateConfig(threadId, {
    isListened: true,
    directInteraction: { enabled: true, allowAiChat: true },
    chatMemory: { enabled: true },
  });
  const imageText = createImageTextMemoryMock();
  const service = createServiceWithMemory(
    configService,
    createChatMemoryMock([]),
    undefined,
    imageText.memory,
  );
  let ocrCalls = 0;
  service.setOcrService({
    extractTextFromBuffer: () => {
      ocrCalls += 1;
      return Promise.resolve('đọc lần hai');
    },
  } as unknown as OcrService);
  const seen: { input?: AgentInput } = {};
  service.setTextInputService({
    process: (input: AgentInput) => {
      seen.input = input;
      return Promise.resolve();
    },
  } as unknown as TextInputService);

  await service.onMessage(photoMessage(threadId, ThreadType.User, '701', 'món nào rẻ nhất'), {
    getOwnId: () => 'bot-id',
  } as unknown as API);

  assert.deepEqual(imageText.asked, ['701']);
  assert.equal(ocrCalls, 0, 'the photo is not read a second time');
  assert.match(seen.input?.text ?? '', /CƠM GÀ 45\.000/);
});

async function createMemberAccessScenario(
  threadId: string,
  memberAccess: { mode: 'granted-users' | 'all-members' | 'selected-members'; memberIds: string[] },
) {
  const configService = new ThreadConfigService();
  await configService.updateConfig(threadId, {
    threadType: 'group',
    isListened: true,
    directInteraction: { enabled: true, allowAiChat: true },
    memberAccess,
  });

  const processed: AgentInput[] = [];
  const mockTextInputService = {
    process: (input: AgentInput) => {
      processed.push(input);
      return Promise.resolve();
    },
  } as unknown as TextInputService;
  const rejections: string[] = [];
  const messenger = {
    sendMessage: (_chatId: string, text: string) => {
      rejections.push(text);
      return Promise.resolve(true);
    },
  } as unknown as ZcaService;

  const usersService = createUsersServiceMock({ granted: ['global-1'] });
  const service = new ZcaBotFeatureService(configService);
  service.setTextInputService(mockTextInputService);
  service.setUsersService(usersService);
  service.setGrantAccessGuard(new GrantAccessGuard(usersService, messenger));

  const send = (uidFrom: string, content: string) =>
    service.onMessage(
      {
        threadId,
        isSelf: false,
        type: ThreadType.Group,
        data: { content, uidFrom, dName: 'Member', msgType: 'chat' },
      } as unknown as Message,
      {
        sendMessage: () => Promise.resolve({ message: { msgId: 1 }, attachment: [] }),
      } as unknown as API,
    );

  return { processed, rejections, usersService, send };
}

void test('ZcaBotFeatureService lets a selected group member call the bot without global access', async () => {
  const scenario = await createMemberAccessScenario('group-selected-members', {
    mode: 'selected-members',
    memberIds: ['member-1'],
  });

  await scenario.send('member-1', '@bot ăn trưa 45k');
  await scenario.send('stranger-1', '@bot ăn trưa 45k');
  await scenario.send('global-1', '@bot ăn trưa 45k');

  assert.deepEqual(
    scenario.processed.map((input) => input.senderId),
    ['member-1', 'global-1'],
    'selected member and globally granted user pass; the stranger is blocked',
  );
  assert.equal(scenario.rejections.length, 1);
  assert.match(scenario.rejections[0], /stranger-1/);
  assert.deepEqual(scenario.usersService.registered, ['member-1', 'stranger-1', 'global-1']);
});

void test('ZcaBotFeatureService lets every member call the bot when the group allows all members', async () => {
  const scenario = await createMemberAccessScenario('group-all-members', {
    mode: 'all-members',
    memberIds: [],
  });

  await scenario.send('stranger-1', '@bot mai 9h họp');

  assert.equal(scenario.processed.length, 1);
  assert.equal(scenario.rejections.length, 0);
});

void test('ZcaBotFeatureService keeps the global rule for groups in granted-users mode', async () => {
  const scenario = await createMemberAccessScenario('group-granted-users', {
    mode: 'granted-users',
    memberIds: ['member-1'],
  });

  await scenario.send('member-1', '@bot mai 9h họp');
  await scenario.send('member-1', 'chuyện thường trong nhóm');

  assert.equal(scenario.processed.length, 0);
  assert.equal(scenario.rejections.length, 1, 'only the mention is answered with a rejection');
  assert.deepEqual(scenario.usersService.registered, ['member-1']);
});

void test('extractTaggedUsers names tagged members and skips the bot and @All', () => {
  const text = '@Đen 3h nhắc @Trí và @Đạt Đoàn, @All';
  const at = (tag: string) => ({ pos: text.indexOf(tag), len: tag.length });
  const mentions = [
    { uid: 'bot', ...at('@Đen') },
    { uid: '222', ...at('@Trí') },
    { uid: '111', ...at('@Đạt Đoàn') },
    { uid: '222', ...at('@Trí') },
    { uid: '-1', ...at('@All') },
  ];
  assert.deepEqual(extractTaggedUsers(text, mentions, 'bot'), [
    { id: '222', name: 'Trí' },
    { id: '111', name: 'Đạt Đoàn' },
  ]);
  assert.deepEqual(extractTaggedUsers(text, undefined, 'bot'), []);
});

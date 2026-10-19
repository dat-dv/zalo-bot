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
        requireMention: false,
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
      requireMention: true,
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

void test('ZcaBotFeatureService sets passiveOnly=true for group message without @bot or prefix when expenseTracking is enabled', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'group-passive-tracking-test';
  await configService.updateConfig(threadId, {
    isListened: true,
    directInteraction: {
      enabled: false,
      requireMention: true,
      triggerPrefix: '!',
    },
    expenseTracking: {
      enabled: true,
      requireConfirm: false,
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
      content: 'hello bot',
      uidFrom: 'member-1',
      dName: 'Thành viên',
      msgType: 'chat',
    },
  } as unknown as Message;

  await service.onMessage(message, {} as unknown as API);
  assert.ok(processedInput, 'Message should be forwarded for passive expense detection');
  assert.equal(
    processedInput.passiveOnly,
    true,
    'passiveOnly must be true so bot will not chit-chat',
  );
});

void test('ZcaBotFeatureService sets passiveOnly=false when message uses custom prefix or @bot', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'group-prefix-test';
  await configService.updateConfig(threadId, {
    isListened: true,
    directInteraction: {
      enabled: true,
      requireMention: true,
      triggerPrefix: '!',
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

  // 2. Message with @Bot (even though prefix "!" is configured, @Bot still works!)
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

  assert.equal(processedInputs.length, 2);
  assert.equal(processedInputs[0].passiveOnly, false);
  assert.equal(processedInputs[0].triggerPrefix, '!');
  assert.equal(processedInputs[1].passiveOnly, false);
});

void test('ZcaBotFeatureService ignores 1-1 User message without @bot or prefix when requireMention is true (default)', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'user-direct-no-mention-test';
  await configService.updateConfig(threadId, {
    threadType: 'user',
    isListened: true,
    directInteraction: {
      enabled: true,
      requireMention: true,
      triggerPrefix: '!bot',
      allowAiChat: true,
    },
    expenseTracking: {
      enabled: false,
      requireConfirm: false,
    },
    calendarExtraction: {
      enabled: false,
      requireConfirm: false,
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

  // Message "ê bot ơi" has no @bot and does not start with "!bot" -> should be ignored
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

  assert.equal(processedInput, null, 'Message without @bot or prefix in 1-1 chat must be ignored');
});

void test('ZcaBotFeatureService processes 1-1 User message with @bot even when custom triggerPrefix is configured', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'user-direct-at-bot-test';
  await configService.updateConfig(threadId, {
    threadType: 'user',
    isListened: true,
    directInteraction: {
      enabled: true,
      requireMention: true,
      triggerPrefix: '!bot',
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
  assert.equal(processedInput.passiveOnly, false);
});

void test('ZcaBotFeatureService processes 1-1 User message with custom triggerPrefix (!bot)', async () => {
  const configService = new ThreadConfigService();
  const threadId = 'user-direct-prefix-test';
  await configService.updateConfig(threadId, {
    threadType: 'user',
    isListened: true,
    directInteraction: {
      enabled: true,
      requireMention: true,
      triggerPrefix: '!bot',
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
  assert.equal(processedInput.passiveOnly, false);
  assert.equal(processedInput.triggerPrefix, '!bot');
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
    sismember: async (_key: string, member: string) => syncedSet.has(member),
    sadd: async (_key: string, ...members: string[]) => {
      members.forEach((m) => syncedSet.add(m));
      return true;
    },
  } as unknown as import('../redis/redis.service').RedisService;

  const uploadedFiles: { id: string; msgId?: string }[] = [];
  const mockMediaStorageService = {
    uploadImage: (
      _sender: string,
      _buf: Buffer,
      options?: { msgId?: string },
    ) => {
      uploadedFiles.push({ id: `img-${uploadedFiles.length + 1}`, msgId: options?.msgId });
      return Promise.resolve({
        drive: { fileId: `drive-img-${uploadedFiles.length}`, webViewLink: 'https://drive.google.com/img' },
      });
    },
    uploadVideo: (
      _sender: string,
      _buf: Buffer,
      options?: { msgId?: string },
    ) => {
      uploadedFiles.push({ id: `vid-${uploadedFiles.length + 1}`, msgId: options?.msgId });
      return Promise.resolve({
        drive: { fileId: `drive-vid-${uploadedFiles.length}`, webViewLink: 'https://drive.google.com/vid' },
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
    getGroupChatHistory: async (_groupId: string, _count: number) => ({
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


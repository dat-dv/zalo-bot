import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GroupEventType,
  UserMessage,
  GroupMessage,
  isUserMessage,
  isGroupMessage,
  isTextMessage,
  getMessageText,
  getMessageSenderId,
  getMessageThreadId,
  isMentioned,
  normalizeGroupMember,
  getGroupUpdateMembers,
  buildMessageContent,
  buildMention,
  buildQuoteFromMessage,
  isReaction,
  isUndo,
  isGroupEvent,
  isFriendEvent,
  type GroupEvent,
  type TMessage,
  type TGroupMessage,
  type TGroupEventBase,
} from './index';

void test('Shape Guards: isUserMessage and isGroupMessage identify message types', () => {
  const userMsgData: TMessage = {
    actionId: '1',
    msgId: 'm1',
    cliMsgId: 'c1',
    msgType: 'chat.todo',
    uidFrom: 'u1',
    idTo: 'u2',
    dName: 'Alice',
    ts: '123456789',
    status: 1,
    content: 'Hello private',
    notify: '1',
    ttl: 0,
    userId: 'u1',
    uin: '1',
    topOut: '',
    topOutTimeOut: '',
    topOutImprTimeOut: '',
    propertyExt: undefined,
    paramsExt: { countUnread: 0, containType: 0, platformType: 1 },
    cmd: 1,
    st: 1,
    at: 1,
    realMsgId: 'rm1',
    quote: undefined,
  };

  const groupMsgData: TGroupMessage = {
    ...userMsgData,
    content: 'Hello group',
    mentions: [{ uid: 'bot123', pos: 0, len: 4, type: 0 }],
  };

  const userMsg = new UserMessage('botId', userMsgData);
  const groupMsg = new GroupMessage('botId', groupMsgData);

  assert.equal(isUserMessage(userMsg), true);
  assert.equal(isUserMessage(groupMsg), false);

  assert.equal(isGroupMessage(groupMsg), true);
  assert.equal(isGroupMessage(userMsg), false);
});

void test('Shape Guards: isTextMessage and getMessageText handle text and attachments', () => {
  const textMsgData: TMessage = {
    actionId: '1',
    msgId: 'm1',
    cliMsgId: 'c1',
    msgType: 'chat.todo',
    uidFrom: 'u1',
    idTo: 'u2',
    dName: 'Alice',
    ts: '123456789',
    status: 1,
    content: 'Test content message',
    notify: '1',
    ttl: 0,
    userId: 'u1',
    uin: '1',
    topOut: '',
    topOutTimeOut: '',
    topOutImprTimeOut: '',
    propertyExt: undefined,
    paramsExt: { countUnread: 0, containType: 0, platformType: 1 },
    cmd: 1,
    st: 1,
    at: 1,
    realMsgId: 'rm1',
    quote: undefined,
  };

  const textMsg = new UserMessage('botId', textMsgData);
  assert.equal(isTextMessage(textMsg), true);
  assert.equal(getMessageText(textMsg), 'Test content message');
  assert.equal(getMessageSenderId(textMsg), 'u1');
  assert.equal(getMessageThreadId(textMsg), 'u1');

  const attachmentMsgData: TMessage = {
    ...textMsgData,
    content: {
      title: 'Invoice PDF',
      description: 'Document details',
      href: 'https://example.com/invoice.pdf',
      thumb: '',
      childnumber: 0,
      action: '',
      params: '',
      type: 'document',
    },
  };
  const attachmentMsg = new UserMessage('botId', attachmentMsgData);
  assert.equal(isTextMessage(attachmentMsg), false);
  assert.equal(getMessageText(attachmentMsg), 'Invoice PDF');
});

void test('Shape Guards: isMentioned checks for target userId in mentions', () => {
  const groupMsgData: TGroupMessage = {
    actionId: '1',
    msgId: 'm1',
    cliMsgId: 'c1',
    msgType: 'chat.todo',
    uidFrom: 'u1',
    idTo: 'g1',
    dName: 'Alice',
    ts: '123456789',
    status: 1,
    content: '@Bot hello',
    notify: '1',
    ttl: 0,
    userId: 'u1',
    uin: '1',
    topOut: '',
    topOutTimeOut: '',
    topOutImprTimeOut: '',
    propertyExt: undefined,
    paramsExt: { countUnread: 0, containType: 0, platformType: 1 },
    cmd: 1,
    st: 1,
    at: 1,
    realMsgId: 'rm1',
    quote: undefined,
    mentions: [{ uid: 'bot123', pos: 0, len: 4, type: 0 }],
  };

  const groupMsg = new GroupMessage('botId', groupMsgData);
  assert.equal(isMentioned(groupMsg, 'bot123'), true);
  assert.equal(isMentioned(groupMsg, 'user999'), false);
});

void test('Shape Guards: normalizeGroupMember and getGroupUpdateMembers', () => {
  const normalizedString = normalizeGroupMember('uid_123');
  assert.deepEqual(normalizedString, { id: 'uid_123', dName: 'bạn mới' });

  const normalizedObject = normalizeGroupMember({
    id: 'uid_456',
    dName: 'Nguyễn Văn A',
    avatar: 'https://avatar.url',
    type: 1,
    avatar_25: '',
  });
  assert.deepEqual(normalizedObject, {
    id: 'uid_456',
    dName: 'Nguyễn Văn A',
    avatar: 'https://avatar.url',
  });

  const baseEventData: TGroupEventBase = {
    subType: 0,
    groupId: 'g1',
    creatorId: 'c1',
    groupName: 'Group Test',
    sourceId: 's1',
    updateMembers: [
      {
        id: 'u1',
        dName: 'Thành viên mới',
        avatar: '',
        type: 0,
        avatar_25: '',
      },
    ],
    groupSetting: null,
    groupTopic: null,
    info: null,
    extraData: null,
    time: '123456',
    avt: null,
    fullAvt: null,
    isAdd: 1,
    hideGroupInfo: 0,
    version: '1',
    groupType: 0,
  };

  const groupEvent: GroupEvent = {
    type: GroupEventType.JOIN,
    data: baseEventData,
    act: 'join',
    threadId: 'g1',
    isSelf: false,
  };

  const members = getGroupUpdateMembers(groupEvent);
  assert.equal(members.length, 1);
  assert.equal(members[0].id, 'u1');
  assert.equal(members[0].dName, 'Thành viên mới');
});

void test('Shape Guards: buildMessageContent, buildMention, buildQuoteFromMessage', () => {
  const mention = buildMention('u123', 'John Doe', 5);
  assert.deepEqual(mention, {
    pos: 5,
    uid: 'u123',
    len: 9, // '@John Doe'.length
  });

  const content = buildMessageContent('Hello @John Doe', {
    mentions: [mention],
  });
  assert.equal(content.msg, 'Hello @John Doe');
  assert.equal(content.mentions?.length, 1);

  const sampleMsgData: TMessage = {
    actionId: '1',
    msgId: 'msg_999',
    cliMsgId: 'cli_999',
    msgType: 'chat.todo',
    uidFrom: 'sender_1',
    idTo: 'thread_1',
    dName: 'Sender',
    ts: '123456789',
    status: 1,
    content: 'Original message text',
    notify: '1',
    ttl: 30000,
    userId: 'sender_1',
    uin: '1',
    topOut: '',
    topOutTimeOut: '',
    topOutImprTimeOut: '',
    propertyExt: undefined,
    paramsExt: { countUnread: 0, containType: 0, platformType: 1 },
    cmd: 1,
    st: 1,
    at: 1,
    realMsgId: 'rm1',
    quote: undefined,
  };
  const msg = new UserMessage('bot', sampleMsgData);
  const quote = buildQuoteFromMessage(msg);
  assert.equal(quote.msgId, 'msg_999');
  assert.equal(quote.cliMsgId, 'cli_999');
  assert.equal(quote.uidFrom, 'sender_1');
  assert.equal(quote.content, 'Original message text');
});

void test('Shape Guards: isReaction, isUndo, isGroupEvent, isFriendEvent', () => {
  const mockReaction = {
    data: {
      rType: 1,
      source: 1,
      total: 1,
    },
    reaction: 'LIKE',
  };
  assert.equal(isReaction(mockReaction), true);

  const mockUndo = {
    data: {
      content: { action: 'undo' },
    },
    msgId: '123',
  };
  assert.equal(isUndo(mockUndo), true);

  const mockGroupEvent = {
    type: GroupEventType.JOIN,
    act: 'join',
    threadId: 'g1',
  };
  assert.equal(isGroupEvent(mockGroupEvent), true);

  const mockFriendEvent = {
    type: 'add',
    threadId: 'u1',
  };
  assert.equal(isFriendEvent(mockFriendEvent), true);
});

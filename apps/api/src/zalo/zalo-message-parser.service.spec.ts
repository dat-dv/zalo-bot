import assert from 'node:assert/strict';
import test from 'node:test';
import { ZaloMessageParser } from './zalo-message-parser.service';
import { ZaloWebhookEventName } from './dto/zalo-webhook.dto';

void test('ZaloMessageParser parses text messages correctly', () => {
  const parser = new ZaloMessageParser();
  const input = parser.parse({
    message: {
      message_id: '1',
      date: 123456,
      chat: { id: 'c1' },
      from: { id: 'u1', display_name: 'Đạt' },
      text: 'ăn trưa 50k',
    },
  });

  assert.equal(input.type, 'text');
  assert.equal(input.senderId, 'u1');
  assert.equal(input.chatId, 'c1');
  assert.equal(input.displayName, 'Đạt');
  assert.equal(input.text, 'ăn trưa 50k');
});

void test('ZaloMessageParser parses image messages correctly', () => {
  const parser = new ZaloMessageParser();
  const input = parser.parse({
    message: {
      message_id: '2',
      date: 123456,
      chat: { id: 'c1' },
      from: { id: 'u1' },
      photo_url: 'https://photo.zalo.me/bill.jpg',
      caption: 'hóa đơn cà phê',
    },
  });

  assert.equal(input.type, 'image');
  assert.equal(input.imageUrl, 'https://photo.zalo.me/bill.jpg');
  assert.equal(input.caption, 'hóa đơn cà phê');
});

void test('ZaloMessageParser parses voice and sticker messages correctly', () => {
  const parser = new ZaloMessageParser();

  const voiceInput = parser.parse({
    message: {
      message_id: '3',
      date: 123456,
      chat: { id: 'c1' },
      from: { id: 'u1' },
      voice_url: 'https://voice.zalo.me/audio.mp3',
    },
  });
  assert.equal(voiceInput.type, 'voice');
  assert.equal(voiceInput.voiceUrl, 'https://voice.zalo.me/audio.mp3');

  const stickerInput = parser.parse({
    message: {
      message_id: '4',
      date: 123456,
      chat: { id: 'c1' },
      from: { id: 'u1' },
      sticker: 'sticker_999',
    },
  });
  assert.equal(stickerInput.type, 'sticker');
});

void test('ZaloMessageParser parses follow and unfollow events as system events', () => {
  const parser = new ZaloMessageParser();

  const followInput = parser.parse({
    event_name: ZaloWebhookEventName.FOLLOW,
    sender: { id: 'u1' },
  });
  assert.equal(followInput.type, 'event');

  const unfollowInput = parser.parse({
    event_name: ZaloWebhookEventName.UNFOLLOW,
    sender: { id: 'u1' },
  });
  assert.equal(unfollowInput.type, 'event');
});

void test('ZaloMessageParser handles unsupported messages', () => {
  const parser = new ZaloMessageParser();

  const unsupportedInput = parser.parse({
    event_name: ZaloWebhookEventName.MESSAGE_UNSUPPORTED_RECEIVED,
    message: {
      message_id: '5',
      date: 123456,
      chat: { id: 'c1' },
      from: { id: 'u1' },
    },
  });
  assert.equal(unsupportedInput.type, 'unsupported');
});

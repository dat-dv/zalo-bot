import assert from 'node:assert/strict';
import test from 'node:test';
import { HelpToolStrategy } from './help-tool.strategy';
import { ZcaMessengerService } from '../../zca-messenger.service';

void test('HelpToolStrategy includes /zalo-login command in help text', async () => {
  const sentMessages: string[] = [];
  const mockZaloService = {
    sendMessage: async (_chatId: string, text: string) => {
      await Promise.resolve();
      sentMessages.push(text);
      return true;
    },
  } as unknown as ZcaMessengerService;

  const strategy = new HelpToolStrategy(mockZaloService);

  await strategy.execute({
    chatId: 'c1',
    senderId: 'u1',
    displayName: 'User 1',
    text: '/help',
    input: {
      type: 'text',
      senderId: 'u1',
      chatId: 'c1',
      displayName: 'User 1',
    },
  });

  assert.equal(sentMessages.length, 1);
  const helpText = sentMessages[0];
  assert.match(helpText, /^📖 Danh sách lệnh hỗ trợ\n/);
  assert.match(helpText, /^Thu chi và hoá đơn:$/m);
  assert.match(helpText, /^Sổ nợ và cho vay:$/m);
  assert.match(helpText, /^Lịch Google Calendar:$/m);
  assert.match(helpText, /^Việc cần làm:$/m);
  assert.doesNotMatch(helpText, /Google Tasks/);
  assert.match(helpText, /^Hẹn giờ nhắc:$/m);
  // The only place that still teaches the bulk commands, since no notice mentions them.
  assert.match(helpText, /"yes all" \/ "cancel all"/);
  assert.match(helpText, /^Lệnh nhanh:$/m);
  assert.match(helpText, /^Cho admin:$/m);
  assert.match(helpText, /\/reminders/);
  assert.match(helpText, /\/ban <id>/);
  assert.match(helpText, /\/drive/);
  assert.match(helpText, /\/share/);
  assert.match(helpText, /\/zalo-login/);
  assert.match(helpText, /\/zca-login/);
  assert.match(helpText, /\/zalo-logout/);
  assert.match(helpText, /\/zca-logout/);
  // Short chat style: one emoji at the very top, no separator lines, caps headings or tips.
  assert.equal(helpText.match(/\p{Extended_Pictographic}/gu)?.length, 1);
  assert.doesNotMatch(helpText, /━/);
  assert.doesNotMatch(helpText, /TOOLCALLS|HƯỚNG DẪN|LỆNH NHANH|ADMIN\)/);
  assert.doesNotMatch(helpText, /Mẹo|!/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { HelpToolStrategy } from './help-tool.strategy';
import { ZaloService } from '../../zalo.service';

void test('HelpToolStrategy includes /zalo-login command in help text', async () => {
  const sentMessages: string[] = [];
  const mockZaloService = {
    sendMessage: async (_chatId: string, text: string) => {
      await Promise.resolve();
      sentMessages.push(text);
      return true;
    },
  } as unknown as ZaloService;

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
  assert.match(helpText, /HƯỚNG DẪN SỬ DỤNG TRỢ LÝ ZALO/);
  assert.match(helpText, /CÁC TÍNH NĂNG AI THÔNG MINH \(TOOLCALLS HỮU ÍCH\)/);
  assert.match(helpText, /Thu - Chi/);
  assert.match(helpText, /Google Calendar/);
  assert.match(helpText, /Việc cần làm/);
  assert.doesNotMatch(helpText, /Google Tasks/);
  assert.match(helpText, /Reminders/);
  assert.match(helpText, /\/drive/);
  assert.match(helpText, /\/share/);
  assert.match(helpText, /\/zalo-login/);
  assert.match(helpText, /\/zca-login/);
  assert.match(helpText, /\/zalo-logout/);
  assert.match(helpText, /\/zca-logout/);
});

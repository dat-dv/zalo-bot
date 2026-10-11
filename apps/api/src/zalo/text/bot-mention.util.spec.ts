import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanBotMention } from './bot-mention.util';

void test('cleanBotMention removes @Bot at the beginning of sentence (Trường hợp 1)', () => {
  assert.equal(cleanBotMention('@Bot /dashboard'), '/dashboard');
  assert.equal(cleanBotMention('@bot /dashboard'), '/dashboard');
  assert.equal(cleanBotMention('@BOT /help'), '/help');
  assert.equal(cleanBotMention('@Bot: /start 123'), '/start 123');
  assert.equal(cleanBotMention('@Bot, nợ a 100k'), 'nợ a 100k');
  assert.equal(cleanBotMention('@Bot hôm nay chi 50k ăn phở'), 'hôm nay chi 50k ăn phở');
});

void test('cleanBotMention removes @Bot at the end of sentence (Trường hợp 2)', () => {
  assert.equal(cleanBotMention('/dashboard @Bot'), '/dashboard');
  assert.equal(cleanBotMention('/dashboard @bot'), '/dashboard');
  assert.equal(cleanBotMention('/help @BOT'), '/help');
  assert.equal(cleanBotMention('/ping: @Bot'), '/ping');
  assert.equal(cleanBotMention('nợ a 100k @Bot'), 'nợ a 100k');
  assert.equal(cleanBotMention('ăn trưa 45k, @bot'), 'ăn trưa 45k');
});

void test('cleanBotMention removes @Bot after slash commands or in middle', () => {
  assert.equal(cleanBotMention('/dashboard @Bot Teétajjsne'), '/dashboard Teétajjsne');
  assert.equal(cleanBotMention('/dashboard@Bot Teétajjsne'), '/dashboard Teétajjsne');
  assert.equal(cleanBotMention('/dashboard@Bot'), '/dashboard');
  assert.equal(cleanBotMention('/task @Bot mua sữa'), '/task mua sữa');
  assert.equal(cleanBotMention('nhắc @Bot ngày mai họp'), 'nhắc ngày mai họp');
});

void test('cleanBotMention supports custom botName from env', () => {
  assert.equal(cleanBotMention('@MyAssistant /dashboard', 'MyAssistant'), '/dashboard');
  assert.equal(cleanBotMention('/dashboard @MyAssistant', 'MyAssistant'), '/dashboard');
  assert.equal(
    cleanBotMention('/dashboard @myassistant Teétajjsne', 'MyAssistant'),
    '/dashboard Teétajjsne',
  );
  // Fallback to @Bot or @bot still works
  assert.equal(cleanBotMention('@Bot /dashboard', 'MyAssistant'), '/dashboard');
});

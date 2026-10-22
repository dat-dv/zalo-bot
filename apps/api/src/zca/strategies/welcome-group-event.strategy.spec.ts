import test from 'node:test';
import * as assert from 'node:assert/strict';
import { ConfigService } from '@nestjs/config';
import { WelcomeGroupEventStrategy } from './welcome-group-event.strategy';
import { GroupEventType, type GroupEvent } from '../shapes';

void test('WelcomeGroupEventStrategy is disabled by default', () => {
  const strategy = new WelcomeGroupEventStrategy();
  assert.strictEqual(strategy.isEnabled(), false);

  const joinEvent = {
    type: GroupEventType.JOIN,
    threadId: 'group-1',
    isSelf: false,
    act: 'join',
    data: {
      updateMembers: [{ id: 'u1', dName: 'User One' }],
    },
  } as unknown as GroupEvent;

  assert.strictEqual(strategy.canHandle(joinEvent), false, 'Must not handle JOIN when disabled');
});

void test('WelcomeGroupEventStrategy enables via options', () => {
  const strategy = new WelcomeGroupEventStrategy(undefined, { enabled: true });
  assert.strictEqual(strategy.isEnabled(), true);

  const joinEvent = {
    type: GroupEventType.JOIN,
    threadId: 'group-1',
    isSelf: false,
    act: 'join',
    data: {
      updateMembers: [{ id: 'u1', dName: 'User One' }],
    },
  } as unknown as GroupEvent;

  assert.strictEqual(strategy.canHandle(joinEvent), true, 'Must handle JOIN when enabled');

  const selfJoinEvent = {
    ...joinEvent,
    isSelf: true,
  };
  assert.strictEqual(strategy.canHandle(selfJoinEvent), false, 'Must ignore self join event');
});

void test('WelcomeGroupEventStrategy enables via ConfigService zca.enableWelcome', () => {
  const mockConfigService = {
    get: (key: string) => {
      if (key === 'zca.enableWelcome') return true;
      return undefined;
    },
  } as unknown as ConfigService;

  const strategy = new WelcomeGroupEventStrategy(mockConfigService);
  assert.strictEqual(strategy.isEnabled(), true);

  const joinEvent = {
    type: GroupEventType.JOIN,
    threadId: 'group-1',
    isSelf: false,
    act: 'join',
    data: {
      updateMembers: [{ id: 'u1', dName: 'User One' }],
    },
  } as unknown as GroupEvent;

  assert.strictEqual(strategy.canHandle(joinEvent), true);
});

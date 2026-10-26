import assert from 'node:assert/strict';
import test from 'node:test';
import type { Queue } from 'bullmq';
import type { ThreadConfigService } from '../../thread-config.service';
import {
  MemorySegmentScheduler,
  SEGMENT_IDLE_MS,
  SEGMENT_MAX_WAIT_MS,
} from './memory-segment.scheduler';
import { syncResultText } from './memory-ingest.processor';

function createScheduler() {
  const added: Array<{ name: string; data: unknown }> = [];
  const queue = {
    add: (name: string, data: unknown) => {
      added.push({ name, data });
      return Promise.resolve();
    },
  } as unknown as Queue;
  const scheduler = new MemorySegmentScheduler(queue, {} as ThreadConfigService);
  return { scheduler, added };
}

void test('a quiet chat is sent once, SEGMENT_IDLE_MS after its last message', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { scheduler, added } = createScheduler();

  scheduler.noteMessage('g-1', 0);
  t.mock.timers.tick(SEGMENT_IDLE_MS - 1000);
  scheduler.noteMessage('g-1', SEGMENT_IDLE_MS - 1000);
  t.mock.timers.tick(SEGMENT_IDLE_MS - 1);
  assert.equal(added.length, 0, 'each message pushes the timer back');

  t.mock.timers.tick(1);
  assert.deepEqual(added, [{ name: 'segment', data: { channelId: 'g-1' } }]);
  scheduler.onModuleDestroy();
});

void test('a chat that never goes quiet is still sent SEGMENT_MAX_WAIT_MS after the first message', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { scheduler, added } = createScheduler();

  let now = 0;
  while (now < SEGMENT_MAX_WAIT_MS) {
    scheduler.noteMessage('g-1', now);
    t.mock.timers.tick(60_000);
    now += 60_000;
  }
  assert.equal(added.length, 1);
  scheduler.onModuleDestroy();
});

void test('a recall or /sync replaces the waiting timer with a job at once', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { scheduler, added } = createScheduler();

  scheduler.noteMessage('g-1', 0);
  scheduler.noteRecall('g-1');
  assert.equal(await scheduler.requestSync({ channelId: 'g-1' }), true);
  t.mock.timers.tick(SEGMENT_MAX_WAIT_MS);

  assert.deepEqual(added, [
    { name: 'segment', data: { channelId: 'g-1', resetToday: true } },
    { name: 'sync', data: { channelId: 'g-1' } },
  ]);
  scheduler.onModuleDestroy();
});

void test('syncResultText says what went in', () => {
  assert.equal(
    syncResultText({ days: 1, todayLines: 3, failed: false }),
    '🧠 Đã cập nhật trí nhớ: 3 tin mới hôm nay, 1 ngày trước còn chờ.',
  );
  assert.equal(
    syncResultText({ days: 0, todayLines: 0, failed: false }),
    '🧠 Trí nhớ đã đủ, không có tin mới.',
  );
  assert.match(syncResultText({ days: 0, todayLines: 0, failed: true }), /Chưa cập nhật được/);
  assert.match(syncResultText(null), /chưa bật Nhớ lâu dài/);
});

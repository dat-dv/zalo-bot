import test from 'node:test';
import assert from 'node:assert/strict';
import type { OcrResult } from '../../ocr/ocr.service';
import {
  IMAGE_TEXT_QUEUE_MAX_PENDING,
  ImageTextMemoryService,
  type ImageTextJob,
  type ImageTextLongTermMemory,
  type ImageTextOcr,
} from './image-text-memory.service';

const MENU: OcrResult = { text: 'CƠM GÀ 45.000\nBÚN BÒ 50.000', confidence: 85 };

/** A `data:` URL, so fetching the photo needs no network; its bytes name the photo. */
function photoUrl(name: string): string {
  return `data:image/png;base64,${Buffer.from(name).toString('base64')}`;
}

function job(msgId: string, extra: Partial<ImageTextJob> = {}): ImageTextJob {
  return {
    channelId: 'g-1',
    channelType: 'group',
    data: {
      msgId,
      msgType: 'chat.photo',
      content: { title: 'menu' },
      uidFrom: 'u1',
      ts: Date.now(),
    },
    imageUrl: photoUrl(msgId),
    shortTermDays: 1,
    longTerm: true,
    ...extra,
  };
}

/** Lets queued promise chains run to the end. */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

function createService(
  recognize: (image: Buffer) => Promise<OcrResult> = () => Promise.resolve(MENU),
) {
  const read: string[] = [];
  let active = 0;
  let maxActive = 0;
  const ocr: ImageTextOcr = {
    recognize: async (image) => {
      read.push(image.toString());
      active += 1;
      maxActive = Math.max(maxActive, active);
      try {
        return await recognize(image);
      } finally {
        active -= 1;
      }
    },
  };
  const longTerm: Array<{ channelId: string; msgId: string; text: string }> = [];
  const longTermMemory: ImageTextLongTermMemory = {
    attachImageText: (channelId, msgId, text) => {
      longTerm.push({ channelId, msgId, text });
      return Promise.resolve();
    },
  };
  const service = new ImageTextMemoryService(ocr, longTermMemory);
  return { service, read, longTerm, maxActive: () => maxActive };
}

void test('ImageTextMemoryService reads photos one at a time into the stored row', async () => {
  const { service, read, longTerm, maxActive } = createService();

  service.enqueue(job('p1'));
  service.enqueue(job('p2'));
  await settle();

  assert.deepEqual(read, ['p1', 'p2']);
  assert.equal(maxActive(), 1);
  assert.deepEqual(longTerm[0], {
    channelId: 'g-1',
    msgId: 'p1',
    text: '[Ảnh] menu — chữ trong ảnh: CƠM GÀ 45.000 / BÚN BÒ 50.000',
  });
  assert.deepEqual(
    longTerm.map((entry) => entry.msgId),
    ['p1', 'p2'],
  );
});

void test('ImageTextMemoryService reads photos while either memory is on', async () => {
  // One row serves both memories, so a chat with only the short-term memory still gets the text.
  const shortOnly = createService();
  shortOnly.service.enqueue(job('p1', { longTerm: false }));
  await settle();
  assert.equal(shortOnly.longTerm.length, 1);

  const none = createService();
  none.service.enqueue(job('p1', { longTerm: false, shortTermDays: undefined }));
  await settle();
  assert.deepEqual(none.read, []);
});

void test('ImageTextMemoryService waits for the long-term row before updating it', async () => {
  const { service, longTerm } = createService();
  let markStored = (): void => undefined;
  const afterStored = new Promise<void>((resolve) => {
    markStored = resolve;
  });

  service.enqueue(job('p1', { afterStored }));
  await settle();
  assert.equal(longTerm.length, 0);

  markStored();
  await settle();
  assert.equal(longTerm.length, 1);
});

void test('ImageTextMemoryService reads a photo once, even when it arrives twice', async () => {
  const { service, read } = createService();

  service.enqueue(job('p1'));
  service.enqueue(job('p1'));
  await settle();
  service.enqueue(job('p1'));
  await settle();

  assert.deepEqual(read, ['p1']);
});

void test('ImageTextMemoryService drops photos beyond the queue limit', async () => {
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { service, read } = createService(async () => {
    await gate;
    return MENU;
  });

  // The first photo is being read; the next ones wait in the queue.
  for (let i = 0; i <= IMAGE_TEXT_QUEUE_MAX_PENDING + 2; i += 1) service.enqueue(job(`p${i}`));
  release();
  await settle();

  assert.equal(read.length, IMAGE_TEXT_QUEUE_MAX_PENDING + 1);
});

void test('ImageTextMemoryService stores nothing for photos without real text', async () => {
  const { service, longTerm } = createService(() =>
    Promise.resolve({ text: '| ~ ee', confidence: 30 }),
  );

  service.enqueue(job('p1'));
  await settle();

  assert.equal(longTerm.length, 0);
});

void test('ImageTextMemoryService.recognizeNow reads a waiting photo at once, only once', async () => {
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { service, read } = createService(async (image) => {
    if (image.toString() === 'busy') await gate;
    return MENU;
  });

  service.enqueue(job('busy'));
  service.enqueue(job('p1'));
  // The bot's reply to p1 does not wait behind "busy" and passes the bytes it already fetched.
  const text = await service.recognizeNow('g-1', 'p1', Buffer.from('fetched-by-bot'));
  release();
  await settle();

  assert.equal(text, MENU.text);
  assert.deepEqual([...read].sort(), ['busy', 'fetched-by-bot']);
  assert.equal(await service.recognizeNow('g-1', 'p1', Buffer.from('again')), MENU.text);
  assert.equal(read.length, 2);
});

void test('ImageTextMemoryService.recognizeNow leaves unknown or unreadable photos to the caller', async () => {
  const { service } = createService(() => Promise.reject(new Error('tesseract crashed')));

  assert.equal(await service.recognizeNow('g-1', 'unknown', Buffer.from('x')), null);
  assert.equal(await service.recognizeNow('g-1', undefined, Buffer.from('x')), null);

  service.enqueue(job('p1'));
  assert.equal(await service.recognizeNow('g-1', 'p1', Buffer.from('x')), null);
});

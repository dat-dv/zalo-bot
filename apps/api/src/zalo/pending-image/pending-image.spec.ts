import assert from 'node:assert/strict';
import test from 'node:test';
import { CancelPendingImageStrategy } from './strategies/cancel-pending-image.strategy';
import { StorageUploadPendingImageStrategy } from './strategies/storage-upload-pending-image.strategy';
import { CreateBillPendingImageStrategy } from './strategies/create-bill-pending-image.strategy';
import { PendingImageActionDispatcher } from './pending-image-dispatcher.service';
import { ImageBatchHandler } from './image-batch-handler.service';
import { PendingImageContext } from './pending-image.interface';
import { ZaloService } from '../zalo.service';
import { PendingImageActionService, PendingImageAction } from '../pending-image-action.service';
import { LlmService } from '../../llm/llm.service';
import { TextToolFactory } from '../text/text-tool.factory';
import { MediaStorageService } from '../../receipt-storage/media-storage.service';
import { OcrService } from '../../ocr/ocr.service';

function createMockSetup() {
  const sentMessages: Array<{ chatId: string; text: string }> = [];

  const mockZaloService = {
    sendMessage: (chatId: string, text: string) => {
      sentMessages.push({ chatId, text });
      return Promise.resolve(true);
    },
    withChatAction: (_chatId: string, fn: () => Promise<unknown>) => fn(),
  } as unknown as ZaloService;

  const pendingStore = new Map<string, PendingImageAction>();
  const mockPendingService = {
    getPending: (userId: string): Promise<PendingImageAction | null> =>
      Promise.resolve(pendingStore.get(userId) || null),
    setPending: (userId: string, data: PendingImageAction): Promise<PendingImageAction> => {
      pendingStore.set(userId, data);
      return Promise.resolve(data);
    },
    clearPending: (userId: string): Promise<void> => {
      pendingStore.delete(userId);
      return Promise.resolve();
    },
    addPendingImage: (
      userId: string,
      data: { userId: string; chatId: string; receiptUrl: string },
    ): Promise<{ action: PendingImageAction; isNew: boolean; totalCount: number }> => {
      const existing = pendingStore.get(userId);
      if (!existing) {
        const action: PendingImageAction = {
          userId: data.userId,
          chatId: data.chatId,
          receiptUrl: data.receiptUrl,
          receiptUrls: [data.receiptUrl],
          createdAt: Date.now(),
          expiresAt: Date.now() + 60000,
        };
        pendingStore.set(userId, action);
        return Promise.resolve({ action, isNew: true, totalCount: 1 });
      }

      const urls = existing.receiptUrls?.length ? [...existing.receiptUrls] : [existing.receiptUrl];
      if (!urls.includes(data.receiptUrl)) {
        urls.push(data.receiptUrl);
      }
      existing.receiptUrls = urls;
      pendingStore.set(userId, existing);
      return Promise.resolve({ action: existing, isNew: false, totalCount: urls.length });
    },
  } as unknown as PendingImageActionService;

  return { sentMessages, mockZaloService, mockPendingService, pendingStore };
}

void test('CancelPendingImageStrategy handles cancel phrases and clears pending', async () => {
  const { sentMessages, mockZaloService, mockPendingService, pendingStore } = createMockSetup();
  const strategy = new CancelPendingImageStrategy(mockZaloService, mockPendingService);

  assert.equal(strategy.canHandle('hủy'), true);
  assert.equal(strategy.canHandle('huỷ'), true);
  assert.equal(strategy.canHandle('cancel'), true);
  assert.equal(strategy.canHandle('bỏ qua'), true);
  assert.equal(strategy.canHandle('2'), false);
  assert.equal(strategy.canHandle('1'), false);

  pendingStore.set('u1', {
    userId: 'u1',
    chatId: 'c1',
    receiptUrl: 'https://img.jpg',
    receiptUrls: ['https://img.jpg'],
    createdAt: Date.now(),
    expiresAt: Date.now() + 60000,
  });

  const context: PendingImageContext = {
    input: { type: 'text', senderId: 'u1', chatId: 'c1', displayName: 'Đạt', text: 'hủy' },
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: 'hủy',
    pending: {
      userId: 'u1',
      chatId: 'c1',
      receiptUrl: 'https://img.jpg',
      receiptUrls: ['https://img.jpg'],
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
    },
  };

  const handled = await strategy.execute(context);
  assert.equal(handled, true);
  assert.equal(pendingStore.has('u1'), false);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /Đã hủy/);
});

void test('StorageUploadPendingImageStrategy handles option 2 upload and messaging', async () => {
  const { sentMessages, mockZaloService, mockPendingService, pendingStore } = createMockSetup();

  const mockMediaStorageService = {
    uploadImage: () =>
      Promise.resolve({
        drive: { name: 'img1.jpg', webViewLink: 'https://drive.google.com/img1' },
        photos: { id: 'p1', productUrl: 'https://photos.google.com/p1' },
      }),
    formatUploadSummary: () => 'ĐÃ LƯU TRỮ HÌNH ẢNH LÊN GOOGLE',
  } as unknown as MediaStorageService;

  const strategy = new StorageUploadPendingImageStrategy(
    mockZaloService,
    mockPendingService,
    mockMediaStorageService,
  );

  assert.equal(strategy.canHandle('2'), true);
  assert.equal(strategy.canHandle('lưu drive'), true);
  assert.equal(strategy.canHandle('1'), false);

  const base64Img =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  pendingStore.set('u1', {
    userId: 'u1',
    chatId: 'c1',
    receiptUrl: base64Img,
    receiptUrls: [base64Img],
    createdAt: Date.now(),
    expiresAt: Date.now() + 60000,
  });

  const context: PendingImageContext = {
    input: { type: 'text', senderId: 'u1', chatId: 'c1', displayName: 'Đạt', text: '2' },
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: '2',
    pending: {
      userId: 'u1',
      chatId: 'c1',
      receiptUrl: base64Img,
      receiptUrls: [base64Img],
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
    },
  };

  const handled = await strategy.execute(context);
  assert.equal(handled, true);
  assert.equal(pendingStore.has('u1'), false);
  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[0].text, /Đang tải ảnh lên Google Drive/);
  assert.match(sentMessages[1].text, /ĐÃ LƯU TRỮ HÌNH ẢNH/);
});

void test('CreateBillPendingImageStrategy handles option 1 OCR and LLM tool execution', async () => {
  const { sentMessages, mockZaloService, mockPendingService, pendingStore } = createMockSetup();

  const mockLlmService = {
    generate: () =>
      Promise.resolve({
        text: '',
        toolCall: {
          name: 'RECORD_TRANSACTION',
          args: {
            type: 'expense',
            amount: 50000,
            category: 'Ăn uống',
            note: 'Cơm tấm',
          },
        },
      }),
  } as unknown as LlmService;

  let toolExecuted = false;
  const mockToolFactory = {
    getStrategy: () => ({
      execute: () => {
        toolExecuted = true;
        return Promise.resolve();
      },
    }),
  } as unknown as TextToolFactory;

  const mockOcrService = {
    extractTextFromBuffer: () => Promise.resolve('CƠM TẤM 50.000đ'),
  } as unknown as OcrService;

  const strategy = new CreateBillPendingImageStrategy(
    mockZaloService,
    mockPendingService,
    mockLlmService,
    mockToolFactory,
    mockOcrService,
  );

  assert.equal(strategy.canHandle('1'), true);
  assert.equal(strategy.canHandle('1 cơm sườn 50k'), true);
  assert.equal(strategy.canHandle('tạo bill'), true);
  assert.equal(strategy.canHandle('2'), false);

  const base64Img =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  pendingStore.set('u1', {
    userId: 'u1',
    chatId: 'c1',
    receiptUrl: base64Img,
    receiptUrls: [base64Img],
    createdAt: Date.now(),
    expiresAt: Date.now() + 60000,
  });

  const context: PendingImageContext = {
    input: { type: 'text', senderId: 'u1', chatId: 'c1', displayName: 'Đạt', text: '1' },
    senderId: 'u1',
    chatId: 'c1',
    displayName: 'Đạt',
    text: '1',
    pending: {
      userId: 'u1',
      chatId: 'c1',
      receiptUrl: base64Img,
      receiptUrls: [base64Img],
      createdAt: Date.now(),
      expiresAt: Date.now() + 60000,
    },
  };

  const handled = await strategy.execute(context);
  assert.equal(handled, true);
  assert.equal(toolExecuted, true);
  assert.equal(pendingStore.has('u1'), false);
  assert.match(sentMessages[0].text, /Tesseract OCR/);
});

void test('PendingImageActionDispatcher routes to matching strategy or clears pending on unrelated message', async () => {
  const { mockZaloService, mockPendingService, pendingStore } = createMockSetup();

  const cancelStrategy = new CancelPendingImageStrategy(mockZaloService, mockPendingService);
  const dispatcher = new PendingImageActionDispatcher(
    cancelStrategy,
    undefined,
    undefined,
    mockPendingService,
  );

  // 1. When no pending image exists
  const noPendingHandled = await dispatcher.dispatch(
    { type: 'text', senderId: 'u1', chatId: 'c1', displayName: 'Đạt', text: 'hủy' },
    'u1',
    'c1',
    'Đạt',
    'hủy',
  );
  assert.equal(noPendingHandled, false);

  // 2. When pending image exists and user cancels
  pendingStore.set('u1', {
    userId: 'u1',
    chatId: 'c1',
    receiptUrl: 'https://img.jpg',
    receiptUrls: ['https://img.jpg'],
    createdAt: Date.now(),
    expiresAt: Date.now() + 60000,
  });
  const cancelHandled = await dispatcher.dispatch(
    { type: 'text', senderId: 'u1', chatId: 'c1', displayName: 'Đạt', text: 'hủy' },
    'u1',
    'c1',
    'Đạt',
    'hủy',
  );
  assert.equal(cancelHandled, true);
  assert.equal(pendingStore.has('u1'), false);

  // 3. When pending image exists and user sends unrelated text (e.g. "thời tiết hôm nay thế nào")
  pendingStore.set('u1', {
    userId: 'u1',
    chatId: 'c1',
    receiptUrl: 'https://img.jpg',
    receiptUrls: ['https://img.jpg'],
    createdAt: Date.now(),
    expiresAt: Date.now() + 60000,
  });
  const unrelatedHandled = await dispatcher.dispatch(
    {
      type: 'text',
      senderId: 'u1',
      chatId: 'c1',
      displayName: 'Đạt',
      text: 'thời tiết hôm nay thế nào',
    },
    'u1',
    'c1',
    'Đạt',
    'thời tiết hôm nay thế nào',
  );
  assert.equal(unrelatedHandled, false);
  assert.equal(pendingStore.has('u1'), false); // pending should be cleared to let normal chat continue
});

void test('ImageBatchHandler debounces multi-image uploads and sends a single notification', async () => {
  const { sentMessages, mockZaloService, mockPendingService } = createMockSetup();

  const batchHandler = new ImageBatchHandler(mockZaloService, mockPendingService);
  batchHandler.debounceDelayMs = 50; // fast debounce for test

  // Simulate user sending 3 images in rapid succession
  await batchHandler.handle(
    {
      type: 'image',
      senderId: 'u1',
      chatId: 'c1',
      displayName: 'Đạt',
      imageUrl: 'https://img1.jpg',
    },
    'c1',
  );
  await batchHandler.handle(
    {
      type: 'image',
      senderId: 'u1',
      chatId: 'c1',
      displayName: 'Đạt',
      imageUrl: 'https://img2.jpg',
    },
    'c1',
  );
  await batchHandler.handle(
    {
      type: 'image',
      senderId: 'u1',
      chatId: 'c1',
      displayName: 'Đạt',
      imageUrl: 'https://img3.jpg',
    },
    'c1',
  );

  assert.equal(sentMessages.length, 0); // debounce has not fired yet

  // Wait for debounce timer
  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /3 ảnh/);
  assert.match(sentMessages[0].text, /1️⃣ Tạo bill/);
  assert.match(sentMessages[0].text, /2️⃣ Lưu trữ ảnh/);

  batchHandler.onModuleDestroy();
});

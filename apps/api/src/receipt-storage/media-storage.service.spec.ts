import assert from 'node:assert/strict';
import test from 'node:test';
import { MediaStorageService } from './media-storage.service';
import { GoogleDriveService } from '../google/google-drive.service';
import { GooglePhotosService } from '../google/google-photos.service';
import { GoogleAuthService } from '../google/google-auth.service';
import { buildChannelStorageTarget } from '../google/channel-storage.util';
import { ChannelStorageLinkService } from '../zca/storage/channel-storage-link.service';
import type { ChannelStorageLinkInput } from '../zca/storage/channel-storage-link.service';

const target = buildChannelStorageTarget('g-12345', { threadName: 'Nhà' });

void test('MediaStorageService dual uploads bill to both Drive and Photos', async () => {
  const mockDriveService = {
    uploadReceipt: async () => {
      await Promise.resolve();
      return {
        fileId: 'drive_123',
        name: 'bill_20261012.jpg',
        webViewLink: 'https://drive.google.com/file/d/drive_123/view',
        folderPath: 'zalobot/bill/2026-10',
      };
    },
  } as unknown as GoogleDriveService;

  const mockPhotosService = {
    uploadBillPhoto: async () => {
      await Promise.resolve();
      return {
        mediaItemId: 'photo_123',
        productUrl: 'https://photos.google.com/photo/photo_123',
        albumTitle: 'ZaloBot - Hóa đơn',
      };
    },
  } as unknown as GooglePhotosService;

  const service = new MediaStorageService(mockDriveService, mockPhotosService);
  const result = await service.uploadBill('user_1', Buffer.from('test'), target);

  assert.equal(result.drive?.fileId, 'drive_123');
  assert.equal(result.photos?.mediaItemId, 'photo_123');
  assert.equal(result.driveError, undefined);
  assert.equal(result.photosError, undefined);

  const summary = service.formatUploadSummary(result, 'bill');
  assert.match(summary, /Google Drive/);
  assert.match(summary, /Google Photos/);
  assert.match(summary, /https:\/\/drive\.google\.com/);
  assert.match(summary, /https:\/\/photos\.google\.com/);
});

void test('MediaStorageService handles partial failure gracefully if Photos fails', async () => {
  const mockDriveService = {
    uploadImage: async () => {
      await Promise.resolve();
      return {
        fileId: 'drive_456',
        name: 'image_123.jpg',
        webViewLink: 'https://drive.google.com/file/d/drive_456/view',
        folderPath: 'zalobot/image/2026-10',
      };
    },
  } as unknown as GoogleDriveService;

  const mockPhotosService = {
    uploadGeneralPhoto: async () => {
      await Promise.resolve();
      throw new Error('Google Photos API quota exceeded');
    },
  } as unknown as GooglePhotosService;

  const service = new MediaStorageService(mockDriveService, mockPhotosService);
  const result = await service.uploadImage('user_1', Buffer.from('test'), target);

  assert.equal(result.drive?.fileId, 'drive_456');
  assert.equal(result.photos, undefined);
  assert.match(result.photosError || '', /quota exceeded/);

  const summary = service.formatUploadSummary(result, 'image');
  assert.match(summary, /Google Drive/);
  assert.match(summary, /Lỗi lưu trữ/);
});

void test('MediaStorageService routes uploads to the channel target folders', async () => {
  let capturedBillFolder: string | undefined;
  let capturedImageFolder: string | undefined;
  let capturedVideoFolder: string | undefined;

  const mockDriveService = {
    uploadReceipt: (_buf: Buffer, _sender: string, options?: { folderPath?: string }) => {
      capturedBillFolder = options?.folderPath;
      return Promise.resolve({
        fileId: 'b1',
        name: 'bill.jpg',
        folderPath: capturedBillFolder || '',
      });
    },
    uploadImage: (_buf: Buffer, _sender: string, options?: { folderPath?: string }) => {
      capturedImageFolder = options?.folderPath;
      return Promise.resolve({
        fileId: 'i1',
        name: 'img.jpg',
        folderPath: capturedImageFolder || '',
      });
    },
    uploadVideo: (_buf: Buffer, _sender: string, options?: { folderPath?: string }) => {
      capturedVideoFolder = options?.folderPath;
      return Promise.resolve({
        fileId: 'v1',
        name: 'vid.mp4',
        folderPath: capturedVideoFolder || '',
      });
    },
  } as unknown as GoogleDriveService;

  const service = new MediaStorageService(mockDriveService);
  await service.uploadBill('user_1', Buffer.from('test'), target);
  await service.uploadImage('user_1', Buffer.from('test'), target);
  await service.uploadVideo('user_1', Buffer.from('test'), target);

  assert.equal(capturedBillFolder, 'zalobot/g-12345/bill');
  assert.equal(capturedImageFolder, 'zalobot/g-12345/image');
  assert.equal(capturedVideoFolder, 'zalobot/g-12345/video');
});

void test('MediaStorageService forwards msgId and filename to drive options', async () => {
  let capturedOptions: { msgId?: string; filename?: string } | undefined;

  const mockDriveService = {
    uploadImage: (
      _buf: Buffer,
      _sender: string,
      options?: { msgId?: string; filename?: string },
    ) => {
      capturedOptions = options;
      return Promise.resolve({
        fileId: 'img-1',
        name: 'img.jpg',
        folderPath: 'zalobot/g-12345/image',
      });
    },
  } as unknown as GoogleDriveService;

  const service = new MediaStorageService(mockDriveService);
  await service.uploadImage('user_1', Buffer.from('test'), target, {
    msgId: 'msg-999',
    filename: 'custom.png',
  });

  assert.equal(capturedOptions?.msgId, 'msg-999');
  assert.equal(capturedOptions?.filename, 'custom.png');
});

void test('MediaStorageService puts every channel upload into the channel album, never a global default', async () => {
  const albumTitles: (string | undefined)[] = [];
  const photo = (options?: { albumTitle?: string }) => {
    albumTitles.push(options?.albumTitle);
    return Promise.resolve({ mediaItemId: 'p', albumTitle: options?.albumTitle ?? '' });
  };
  const mockPhotosService = {
    uploadBillPhoto: (_b: Buffer, _s: string, o?: { albumTitle?: string }) => photo(o),
    uploadGeneralPhoto: (_b: Buffer, _s: string, o?: { albumTitle?: string }) => photo(o),
    uploadVideo: (_b: Buffer, _s: string, o?: { albumTitle?: string }) => photo(o),
  } as unknown as GooglePhotosService;

  const service = new MediaStorageService(undefined, mockPhotosService);
  await service.uploadBill('u', Buffer.from('x'), target);
  await service.uploadImage('u', Buffer.from('x'), target);
  await service.uploadVideo('u', Buffer.from('x'), target);

  assert.deepEqual(albumTitles, ['[Zalo] Nhà', '[Zalo] Nhà', '[Zalo] Nhà']);
});

void test('MediaStorageService sends a custom folder upload straight into that folder', async () => {
  let folder: string | undefined;
  const mockDriveService = {
    uploadReceipt: (_b: Buffer, _s: string, o?: { folderPath?: string }) => {
      folder = o?.folderPath;
      return Promise.resolve({ fileId: 'f', name: 'bill.jpg', folderPath: folder || '' });
    },
  } as unknown as GoogleDriveService;

  const service = new MediaStorageService(mockDriveService);
  await service.uploadBill(
    'u',
    Buffer.from('x'),
    buildChannelStorageTarget('g-1', { customFolder: ' Nhà/ Chung ', fileSuffix: 'nha' }),
  );

  assert.equal(folder, 'Nhà/Chung');
});

void test('MediaStorageService reuses the recorded album of the current account and records both links', async () => {
  const recorded: ChannelStorageLinkInput[] = [];
  let usedAlbumId: string | undefined;
  const mockDriveService = {
    uploadImage: () => Promise.resolve({ fileId: 'f1', name: 'i.jpg', folderPath: 'x' }),
    ensureFolderPath: (path: string) => Promise.resolve(path === target.driveRoot ? 'root-1' : 'x'),
  } as unknown as GoogleDriveService;
  const mockPhotosService = {
    uploadGeneralPhoto: (_b: Buffer, _s: string, o?: { albumId?: string; albumTitle?: string }) => {
      usedAlbumId = o?.albumId;
      return Promise.resolve({
        mediaItemId: 'm',
        albumTitle: o?.albumTitle ?? '',
        albumId: o?.albumId,
      });
    },
  } as unknown as GooglePhotosService;
  const mockAuthService = {
    getAccountEmail: () => Promise.resolve('shared@gmail.com'),
  } as unknown as GoogleAuthService;
  const mockLinkService = {
    findAlbum: (threadId: string, email: string, title: string) =>
      Promise.resolve(
        threadId === 'g-12345' && email === 'shared@gmail.com' && title === '[Zalo] Nhà'
          ? { resourceId: 'album-1', url: 'https://photos.app.goo.gl/album-1' }
          : null,
      ),
    record: (input: ChannelStorageLinkInput) => {
      recorded.push(input);
      return Promise.resolve();
    },
  } as unknown as ChannelStorageLinkService;

  const service = new MediaStorageService(
    mockDriveService,
    mockPhotosService,
    mockAuthService,
    mockLinkService,
  );
  const result = await service.uploadImage('u', Buffer.from('x'), target);

  assert.equal(usedAlbumId, 'album-1');
  assert.equal(result.photos?.albumUrl, 'https://photos.app.goo.gl/album-1');
  assert.deepEqual(
    recorded.map((r) => [r.kind, r.googleEmail, r.resourceId, r.url, r.label]),
    [
      [
        'drive',
        'shared@gmail.com',
        'root-1',
        'https://drive.google.com/drive/folders/root-1',
        'zalobot/g-12345',
      ],
      ['photos', 'shared@gmail.com', 'album-1', 'https://photos.app.goo.gl/album-1', '[Zalo] Nhà'],
    ],
  );
});

void test('MediaStorageService keeps the upload result when recording the link fails', async () => {
  const mockDriveService = {
    uploadImage: () => Promise.resolve({ fileId: 'f1', name: 'i.jpg', folderPath: 'x' }),
    ensureFolderPath: () => Promise.reject(new Error('quota')),
  } as unknown as GoogleDriveService;

  const service = new MediaStorageService(mockDriveService);
  const result = await service.uploadImage('u', Buffer.from('x'), target);

  assert.equal(result.drive?.fileId, 'f1');
  assert.equal(result.driveError, undefined);
});

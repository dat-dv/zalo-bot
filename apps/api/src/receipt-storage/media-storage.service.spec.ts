import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate as nextTick } from 'node:timers/promises';
import { MediaStorageService } from './media-storage.service';
import { GoogleDriveService } from '../google/google-drive.service';
import {
  GooglePhotosService,
  type ChannelPhotoOptions,
  type PhotosUploadResult,
} from '../google/google-photos.service';
import { GoogleAuthService } from '../google/google-auth.service';
import { buildChannelStorageTarget } from '../google/channel-storage.util';
import { ChannelStorageLinkService } from '../zca/storage/channel-storage-link.service';
import type { ChannelStorageLinkInput } from '../zca/storage/channel-storage-link.service';

const target = buildChannelStorageTarget('g-12345', { threadName: 'Nhà' });
const EMAIL = 'shared@gmail.com';

const sharedAuth = (email: string | null = EMAIL) =>
  ({ getAccountEmail: () => Promise.resolve(email) }) as unknown as GoogleAuthService;

const recordedAlbum = (resourceId: string): ChannelStorageLinkInput => ({
  threadId: target.channelId,
  kind: 'photos',
  googleEmail: EMAIL,
  resourceId,
  url: `https://photos.app.goo.gl/${resourceId}`,
  label: target.photosAlbumTitle,
});

/** `channel_storage_links` in memory: `record` moves a row to the end (most recently used). */
function memoryLinks(initial: ChannelStorageLinkInput[] = []) {
  const rows = [...initial];
  const service = {
    findAlbum: async (threadId: string, email: string, title: string) => {
      await Promise.resolve();
      const matches = rows.filter(
        (r) =>
          r.kind === 'photos' &&
          r.threadId === threadId &&
          r.googleEmail === email &&
          r.label === title,
      );
      const row = matches[matches.length - 1];
      return row ? { resourceId: row.resourceId, url: row.url } : null;
    },
    record: (input: ChannelStorageLinkInput) => {
      const index = rows.findIndex(
        (r) =>
          r.threadId === input.threadId &&
          r.kind === input.kind &&
          r.resourceId === input.resourceId,
      );
      if (index >= 0) rows.splice(index, 1);
      rows.push(input);
      return Promise.resolve();
    },
  } as unknown as ChannelStorageLinkService;
  return { service, rows };
}

const photoResult = (o: ChannelPhotoOptions): PhotosUploadResult => ({
  mediaItemId: 'm',
  productUrl: 'https://photos.google.com/photo/m',
  albumTitle: o.album.title,
  albumId: o.album.id,
  albumUrl: o.album.url,
});

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
    uploadBillPhoto: async (_b: Buffer, _s: string, o: ChannelPhotoOptions) => {
      await Promise.resolve();
      return { ...photoResult(o), mediaItemId: 'photo_123' };
    },
  } as unknown as GooglePhotosService;

  const service = new MediaStorageService(
    mockDriveService,
    mockPhotosService,
    sharedAuth(),
    memoryLinks([recordedAlbum('album-1')]).service,
  );
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

void test('MediaStorageService keeps the album and reports the error when Photos fails', async () => {
  let createdAlbums = 0;
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
    createAlbum: () => {
      createdAlbums += 1;
      return Promise.resolve({ id: 'dup', url: 'https://photos/dup' });
    },
    uploadGeneralPhoto: async () => {
      await Promise.resolve();
      throw new Error('Google Photos API quota exceeded');
    },
  } as unknown as GooglePhotosService;

  const service = new MediaStorageService(
    mockDriveService,
    mockPhotosService,
    sharedAuth(),
    memoryLinks([recordedAlbum('album-1')]).service,
  );
  const result = await service.uploadImage('user_1', Buffer.from('test'), target);

  assert.equal(result.drive?.fileId, 'drive_456');
  assert.equal(result.photos, undefined);
  assert.match(result.photosError || '', /quota exceeded/);
  assert.equal(createdAlbums, 0);

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
  const albums: string[] = [];
  const photo = (o: ChannelPhotoOptions) => {
    albums.push(`${o.album.id}:${o.album.title}`);
    return Promise.resolve(photoResult(o));
  };
  const mockPhotosService = {
    uploadBillPhoto: (_b: Buffer, _s: string, o: ChannelPhotoOptions) => photo(o),
    uploadGeneralPhoto: (_b: Buffer, _s: string, o: ChannelPhotoOptions) => photo(o),
    uploadVideo: (_b: Buffer, _s: string, o: ChannelPhotoOptions) => photo(o),
  } as unknown as GooglePhotosService;

  const service = new MediaStorageService(
    undefined,
    mockPhotosService,
    sharedAuth(),
    memoryLinks([recordedAlbum('album-1')]).service,
  );
  await service.uploadBill('u', Buffer.from('x'), target);
  await service.uploadImage('u', Buffer.from('x'), target);
  await service.uploadVideo('u', Buffer.from('x'), target);

  assert.deepEqual(albums, ['album-1:[Zalo] Nhà', 'album-1:[Zalo] Nhà', 'album-1:[Zalo] Nhà']);
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
    createAlbum: () => Promise.reject(new Error('must not create an album')),
    uploadGeneralPhoto: (_b: Buffer, _s: string, o: ChannelPhotoOptions) => {
      usedAlbumId = o.album.id;
      return Promise.resolve(photoResult(o));
    },
  } as unknown as GooglePhotosService;
  const mockLinkService = {
    findAlbum: (threadId: string, email: string, title: string) =>
      Promise.resolve(
        threadId === 'g-12345' && email === EMAIL && title === '[Zalo] Nhà'
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
    sharedAuth(),
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
        EMAIL,
        'root-1',
        'https://drive.google.com/drive/folders/root-1',
        'zalobot/g-12345',
      ],
      ['photos', EMAIL, 'album-1', 'https://photos.app.goo.gl/album-1', '[Zalo] Nhà'],
    ],
  );
});

void test('MediaStorageService creates one album for a burst of uploads and records it before adding media', async () => {
  const events: string[] = [];
  const links = memoryLinks();
  const record = links.service.record.bind(links.service);
  Reflect.set(links.service, 'record', (input: ChannelStorageLinkInput) => {
    events.push(`record:${input.resourceId}`);
    return record(input);
  });
  const mockPhotosService = {
    createAlbum: async (title: string) => {
      events.push(`create:${title}`);
      await nextTick();
      return { id: 'album-new', url: 'https://photos/new' };
    },
    uploadGeneralPhoto: (_b: Buffer, _s: string, o: ChannelPhotoOptions) => {
      events.push(`add:${o.album.id}`);
      return Promise.resolve(photoResult(o));
    },
  } as unknown as GooglePhotosService;

  const service = new MediaStorageService(
    undefined,
    mockPhotosService,
    sharedAuth(),
    links.service,
  );
  const results = await Promise.all(
    [1, 2, 3].map(() => service.uploadImage('u', Buffer.from('x'), target)),
  );

  assert.deepEqual(
    results.map((r) => r.photos?.albumId),
    ['album-new', 'album-new', 'album-new'],
  );
  assert.equal(events.filter((e) => e.startsWith('create:')).length, 1);
  assert.equal(events[0], 'create:[Zalo] Nhà');
  assert.equal(events[1], 'record:album-new');
  assert.deepEqual(
    links.rows.map((r) => r.resourceId),
    ['album-new'],
  );
});

void test('MediaStorageService replaces a refused album once, even for concurrent uploads', async () => {
  let createdAlbums = 0;
  const links = memoryLinks([recordedAlbum('album-old')]);
  const mockPhotosService = {
    createAlbum: async () => {
      createdAlbums += 1;
      await nextTick();
      return { id: 'album-new', url: 'https://photos/new' };
    },
    uploadGeneralPhoto: async (_b: Buffer, _s: string, o: ChannelPhotoOptions) => {
      // Google refuses only the old album.
      if (o.album.id !== 'album-old') return photoResult(o);
      staleReplace = o.replaceAlbum;
      const replacement = await o.replaceAlbum?.(o.album.id);
      return photoResult({ ...o, album: { ...o.album, ...replacement } });
    },
  } as unknown as GooglePhotosService;
  let staleReplace: ChannelPhotoOptions['replaceAlbum'];

  const service = new MediaStorageService(
    undefined,
    mockPhotosService,
    sharedAuth(),
    links.service,
  );
  const [first, second] = await Promise.all([
    service.uploadImage('u', Buffer.from('x'), target),
    service.uploadImage('u', Buffer.from('x'), target),
  ]);
  // An upload that still held the old album asks again after the replacement finished.
  const reused = await staleReplace?.('album-old');
  const later = await service.uploadImage('u', Buffer.from('x'), target);

  assert.equal(createdAlbums, 1);
  assert.equal(first.photos?.albumId, 'album-new');
  assert.equal(second.photos?.albumId, 'album-new');
  assert.equal(reused?.id, 'album-new');
  assert.equal(later.photos?.albumId, 'album-new');
});

void test('MediaStorageService never creates an album when the shared account email is unknown', async () => {
  let createdAlbums = 0;
  const mockPhotosService = {
    createAlbum: () => {
      createdAlbums += 1;
      return Promise.resolve({ id: 'orphan', url: 'https://photos/orphan' });
    },
    uploadGeneralPhoto: (_b: Buffer, _s: string, o: ChannelPhotoOptions) =>
      Promise.resolve(photoResult(o)),
  } as unknown as GooglePhotosService;

  const service = new MediaStorageService(
    undefined,
    mockPhotosService,
    sharedAuth(null),
    memoryLinks().service,
  );
  const result = await service.uploadImage('u', Buffer.from('x'), target);

  assert.equal(createdAlbums, 0);
  assert.equal(result.photos, undefined);
  assert.match(result.photosError || '', /tài khoản Google/);
});

void test('MediaStorageService.syncCurrentStorage reads the album from history, not Google', async () => {
  const mockDriveService = {
    hasStorageScopes: () => true,
    ensureFolderPath: () => Promise.resolve('root-1'),
  } as unknown as GoogleDriveService;
  const mockPhotosService = {
    createAlbum: () => Promise.reject(new Error('must not create an album')),
    findAlbumInfo: () => Promise.reject(new Error('must not list albums')),
  } as unknown as GooglePhotosService;
  const mockAuthService = {
    isSharedAuthorized: () => true,
    getAccountEmail: () => Promise.resolve(EMAIL),
  } as unknown as GoogleAuthService;

  const service = new MediaStorageService(
    mockDriveService,
    mockPhotosService,
    mockAuthService,
    memoryLinks([recordedAlbum('album-1')]).service,
  );
  const current = await service.syncCurrentStorage(target);

  assert.deepEqual(current.photos, {
    resourceId: 'album-1',
    url: 'https://photos.app.goo.gl/album-1',
  });
  assert.equal(current.drive?.resourceId, 'root-1');
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

import assert from 'node:assert/strict';
import test from 'node:test';
import { MediaStorageService } from './media-storage.service';
import { GoogleDriveService } from '../google/google-drive.service';
import { GooglePhotosService } from '../google/google-photos.service';

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
  const result = await service.uploadBill('user_1', Buffer.from('test'));

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
  const result = await service.uploadImage('user_1', Buffer.from('test'));

  assert.equal(result.drive?.fileId, 'drive_456');
  assert.equal(result.photos, undefined);
  assert.match(result.photosError || '', /quota exceeded/);

  const summary = service.formatUploadSummary(result, 'image');
  assert.match(summary, /Google Drive/);
  assert.match(summary, /Lỗi lưu trữ/);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getThreadDriveLink,
  getThreadDriveOpenUrl,
  getThreadPhotosLink,
  getThreadPhotosOpenUrl,
} from './zca-api';
import type { ThreadBotConfig } from '@zalobot/contracts';

void test('getThreadDriveOpenUrl returns root open route when threadId is omitted', () => {
  const url = getThreadDriveOpenUrl();
  assert.ok(url.endsWith('/api/drive/open'));
});

void test('getThreadDriveOpenUrl encodes channelId and threadName query params', () => {
  const url = getThreadDriveOpenUrl('g-123', 'Nhóm Dự Án');
  assert.ok(
    url.includes('/api/drive/open?channelId=g-123&threadName=Nh%C3%B3m+D%E1%BB%B1+%C3%81n') ||
      url.includes('channelId=g-123'),
  );
  assert.ok(url.includes('g-123'));
});

void test('getThreadDriveLink uses driveFolderUrl if available on config', () => {
  const config = {
    threadId: 'g-123',
    driveFolderUrl: 'https://drive.google.com/drive/folders/abc123xyz',
  } as ThreadBotConfig;

  const link = getThreadDriveLink({ id: 'g-123', name: 'Nhóm Test' }, config);
  assert.equal(link, 'https://drive.google.com/drive/folders/abc123xyz');
});

void test('getThreadDriveLink falls back to getThreadDriveOpenUrl when driveFolderUrl is missing', () => {
  const link = getThreadDriveLink({ id: 'g-456', name: 'Phòng Kế Toán' }, null);
  assert.ok(link.includes('/api/drive/open'));
  assert.ok(link.includes('g-456'));
});

void test('getThreadPhotosOpenUrl returns root open route when threadId is omitted', () => {
  const url = getThreadPhotosOpenUrl();
  assert.ok(url.endsWith('/api/photos/open'));
});

void test('getThreadPhotosLink uses photosAlbumUrl if available on config', () => {
  const config = {
    threadId: 'g-789',
    photosAlbumUrl: 'https://photos.google.com/album/custom-album-url',
  } as ThreadBotConfig;

  const link = getThreadPhotosLink({ id: 'g-789', name: 'Nhóm Gia Đình' }, config);
  assert.equal(link, 'https://photos.google.com/album/custom-album-url');
});

void test('getThreadPhotosLink falls back to getThreadPhotosOpenUrl when photosAlbumUrl is missing', () => {
  const link = getThreadPhotosLink({ id: 'g-789', name: 'Nhóm Gia Đình' }, null);
  assert.ok(link.includes('/api/photos/open'));
  assert.ok(link.includes('g-789'));
});

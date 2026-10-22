import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChannelStorageLinkEntity } from '../../database/entities/channel-storage-link.entity';
import { isCurrentStorageRow, toChannelStorageLinksResponse } from './channel-storage-links.mapper';

function row(overrides: Partial<ChannelStorageLinkEntity>): ChannelStorageLinkEntity {
  return {
    id: 'id',
    threadId: 'g1',
    kind: 'drive',
    googleEmail: null,
    resourceId: 'r',
    url: 'u',
    label: '',
    firstUsedAt: new Date('2026-01-01T00:00:00Z'),
    lastUsedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

void test('toChannelStorageLinksResponse lists the current link first, then newest first', () => {
  const res = toChannelStorageLinksResponse(
    'g1',
    [
      row({ resourceId: 'old', url: 'u-old', lastUsedAt: new Date('2026-05-01T00:00:00Z') }),
      row({
        resourceId: 'new',
        url: 'u-new',
        googleEmail: 'b@gmail.com',
        lastUsedAt: new Date('2026-09-01T00:00:00Z'),
      }),
      row({ resourceId: 'cur', url: 'u-cur', lastUsedAt: new Date('2026-02-01T00:00:00Z') }),
      row({ kind: 'photos', resourceId: 'album', url: 'u-album', label: '[Zalo] Nhà' }),
    ],
    { drive: { resourceId: 'cur', url: 'u-cur' } },
  );

  assert.deepEqual(
    res.drive.map((l) => [l.url, l.isCurrent]),
    [
      ['u-cur', true],
      ['u-new', false],
      ['u-old', false],
    ],
  );
  assert.equal(res.photos.length, 1);
  assert.equal(res.photos[0].isCurrent, false);
  assert.equal(res.photos[0].label, '[Zalo] Nhà');
});

void test('toChannelStorageLinksResponse merges a backfilled row with the same URL', () => {
  const res = toChannelStorageLinksResponse(
    'g1',
    [
      // Backfilled from the thread config: URL used as id, account unknown.
      row({
        id: 'legacy-row',
        resourceId: 'https://drive/x',
        url: 'https://drive/x',
        label: 'zalobot/g1',
        firstUsedAt: new Date('2026-01-01T00:00:00Z'),
        lastUsedAt: new Date('2026-03-01T00:00:00Z'),
      }),
      row({
        id: 'real-row',
        resourceId: 'folder-x',
        url: 'https://drive/x',
        googleEmail: 'a@gmail.com',
        displayName: 'Kho nhà',
        firstUsedAt: new Date('2026-04-01T00:00:00Z'),
        lastUsedAt: new Date('2026-06-01T00:00:00Z'),
      }),
    ],
    { drive: { resourceId: 'folder-x', url: 'https://drive/x' } },
  );

  assert.equal(res.drive.length, 1);
  assert.deepEqual(res.drive[0], {
    id: 'legacy-row',
    kind: 'drive',
    url: 'https://drive/x',
    label: 'zalobot/g1',
    displayName: 'Kho nhà',
    googleEmail: 'a@gmail.com',
    firstUsedAt: '2026-01-01T00:00:00.000Z',
    lastUsedAt: '2026-06-01T00:00:00.000Z',
    isCurrent: true,
  });
});

void test('toChannelStorageLinksResponse marks nothing current when Google is not connected', () => {
  const res = toChannelStorageLinksResponse('g1', [row({})]);
  assert.equal(res.drive[0].isCurrent, false);
  assert.deepEqual(res.photos, []);
});

void test('isCurrentStorageRow matches the current resource of the row kind only', () => {
  const current = {
    drive: { resourceId: 'root-1', url: 'https://drive/root-1' },
    photos: { resourceId: 'album-1', url: 'https://photos/album-1' },
  };
  assert.equal(isCurrentStorageRow(row({ resourceId: 'root-1' }), current), true);
  assert.equal(isCurrentStorageRow(row({ url: 'https://drive/root-1' }), current), true);
  assert.equal(isCurrentStorageRow(row({ kind: 'photos', resourceId: 'root-1' }), current), false);
  assert.equal(isCurrentStorageRow(row({ resourceId: 'old' }), current), false);
  assert.equal(isCurrentStorageRow(row({ resourceId: 'root-1' }), {}), false);
});

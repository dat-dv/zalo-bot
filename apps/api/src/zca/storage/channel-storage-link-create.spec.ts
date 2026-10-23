import assert from 'node:assert/strict';
import test from 'node:test';
import {
  channelStorageResourceIdFromUrl,
  validateChannelStorageLinkCreate,
} from '@zalobot/contracts';
import type { Repository } from 'typeorm';
import type { ChannelStorageLinkEntity } from '../../database/entities/channel-storage-link.entity';
import { ChannelStorageLinkService } from './channel-storage-link.service';

const FOLDER_URL = 'https://drive.google.com/drive/folders/1PRNn7HDC-7sD7GYOZBHOoed6l3UNQQxR';

void test('channelStorageResourceIdFromUrl reads the folder / album id, else keeps the link', () => {
  assert.equal(
    channelStorageResourceIdFromUrl('drive', FOLDER_URL),
    '1PRNn7HDC-7sD7GYOZBHOoed6l3UNQQxR',
  );
  assert.equal(
    channelStorageResourceIdFromUrl(
      'drive',
      'https://drive.google.com/drive/u/0/folders/abc_1?usp=sharing',
    ),
    'abc_1',
  );
  assert.equal(
    channelStorageResourceIdFromUrl('photos', 'https://photos.google.com/lr/album/AF1Qip-x'),
    'AF1Qip-x',
  );
  assert.equal(
    channelStorageResourceIdFromUrl('photos', 'https://photos.google.com/album/AF1Qip-x'),
    'AF1Qip-x',
  );
  assert.equal(
    channelStorageResourceIdFromUrl('photos', 'https://photos.app.goo.gl/short'),
    'https://photos.app.goo.gl/short',
  );
  assert.equal(channelStorageResourceIdFromUrl('drive', 'not a url'), 'not a url');
});

void test('validateChannelStorageLinkCreate requires a link and normalizes the optional fields', () => {
  assert.deepEqual(validateChannelStorageLinkCreate('drive', { url: '  ' }, []), {
    ok: false,
    errors: { url: 'url_required' },
  });
  assert.deepEqual(
    validateChannelStorageLinkCreate(
      'drive',
      { url: ` ${FOLDER_URL} `, displayName: '  Kho cũ ', googleEmail: ' Old@Gmail.com' },
      [],
    ),
    {
      ok: true,
      value: { url: FOLDER_URL, displayName: 'Kho cũ', googleEmail: 'old@gmail.com' },
    },
  );
  assert.deepEqual(
    validateChannelStorageLinkCreate('photos', { url: 'https://photos.app.goo.gl/a' }, []),
    {
      ok: true,
      value: { url: 'https://photos.app.goo.gl/a', displayName: null, googleEmail: null },
    },
  );
});

void test('validateChannelStorageLinkCreate refuses a link the channel already lists', () => {
  const errorOf = (kind: 'drive' | 'photos', url: string, existing: string[]) => {
    const result = validateChannelStorageLinkCreate(kind, { url }, existing);
    return 'errors' in result ? result.errors.url : undefined;
  };
  assert.equal(errorOf('drive', FOLDER_URL, [FOLDER_URL]), 'url_duplicate');
  // Same folder, other URL form.
  assert.equal(
    errorOf(
      'drive',
      'https://drive.google.com/drive/u/0/folders/1PRNn7HDC-7sD7GYOZBHOoed6l3UNQQxR',
      [FOLDER_URL],
    ),
    'url_duplicate',
  );
  assert.equal(
    errorOf('photos', 'https://photos.google.com/album/AF1Qip-x', [
      'https://photos.google.com/lr/album/AF1Qip-x',
    ]),
    'url_duplicate',
  );
  assert.equal(
    errorOf('drive', 'https://drive.google.com/drive/folders/other', [FOLDER_URL]),
    undefined,
  );
  assert.equal(errorOf('drive', 'https://photos.google.com/album/x', []), 'url_wrong_host');
});

void test('validateChannelStorageLinkCreate reports every field error at once', () => {
  assert.deepEqual(
    validateChannelStorageLinkCreate(
      'drive',
      { url: FOLDER_URL, displayName: 'x'.repeat(121), googleEmail: 'nope' },
      [FOLDER_URL],
    ),
    {
      ok: false,
      errors: {
        displayName: 'display_name_too_long',
        googleEmail: 'email_invalid',
        url: 'url_duplicate',
      },
    },
  );
});

void test('ChannelStorageLinkService.createLink saves the row keyed by the folder id', async () => {
  let saved: Partial<ChannelStorageLinkEntity> | undefined;
  const repo = {
    create: (entity: Partial<ChannelStorageLinkEntity>) => entity,
    save: (entity: Partial<ChannelStorageLinkEntity>) => {
      saved = entity;
      return Promise.resolve(entity);
    },
  } as unknown as Repository<ChannelStorageLinkEntity>;
  const service = new ChannelStorageLinkService(repo);
  const createdAt = new Date('2026-10-23T03:00:00Z');

  await service.createLink({
    threadId: 'g1',
    kind: 'drive',
    link: { url: FOLDER_URL, displayName: 'Kho cũ', googleEmail: null },
    createdAt,
  });

  assert.deepEqual(saved, {
    threadId: 'g1',
    kind: 'drive',
    resourceId: '1PRNn7HDC-7sD7GYOZBHOoed6l3UNQQxR',
    url: FOLDER_URL,
    label: '',
    displayName: 'Kho cũ',
    googleEmail: null,
    firstUsedAt: createdAt,
    lastUsedAt: createdAt,
  });
});

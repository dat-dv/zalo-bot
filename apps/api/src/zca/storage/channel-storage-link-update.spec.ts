import assert from 'node:assert/strict';
import test from 'node:test';
import { validateChannelStorageLinkUpdate } from '@zalobot/contracts';
import type { Repository } from 'typeorm';
import type { ChannelStorageLinkEntity } from '../../database/entities/channel-storage-link.entity';
import { ChannelStorageLinkService } from './channel-storage-link.service';

void test('validateChannelStorageLinkUpdate trims and turns empty name/email into null', () => {
  const result = validateChannelStorageLinkUpdate('drive', {
    displayName: '   ',
    googleEmail: '  A@Gmail.com ',
    url: ' https://drive.google.com/drive/folders/abc ',
  });
  assert.deepEqual(result, {
    ok: true,
    value: {
      displayName: null,
      googleEmail: 'a@gmail.com',
      url: 'https://drive.google.com/drive/folders/abc',
    },
  });
  assert.deepEqual(validateChannelStorageLinkUpdate('drive', { googleEmail: '' }), {
    ok: true,
    value: { googleEmail: null },
  });
});

void test('validateChannelStorageLinkUpdate leaves omitted fields unchanged', () => {
  assert.deepEqual(validateChannelStorageLinkUpdate('photos', {}), { ok: true, value: {} });
});

void test('validateChannelStorageLinkUpdate only accepts https links on the kind hosts', () => {
  const errorOf = (kind: 'drive' | 'photos', url: string) => {
    const result = validateChannelStorageLinkUpdate(kind, { url });
    return 'errors' in result ? result.errors.url : undefined;
  };
  assert.equal(errorOf('drive', ''), 'url_required');
  assert.equal(errorOf('drive', 'not a url'), 'url_invalid');
  assert.equal(errorOf('drive', 'http://drive.google.com/drive/folders/x'), 'url_invalid');
  assert.equal(errorOf('drive', 'https://photos.google.com/album/x'), 'url_wrong_host');
  assert.equal(errorOf('drive', 'https://evil.example/drive.google.com'), 'url_wrong_host');
  assert.equal(errorOf('photos', 'https://photos.app.goo.gl/abc'), undefined);
  assert.equal(errorOf('photos', 'https://photos.google.com/album/x'), undefined);
});

void test('validateChannelStorageLinkUpdate rejects a long name and a bad email together', () => {
  const result = validateChannelStorageLinkUpdate('drive', {
    displayName: 'x'.repeat(121),
    googleEmail: 'not-an-email',
  });
  assert.deepEqual(result, {
    ok: false,
    errors: { displayName: 'display_name_too_long', googleEmail: 'email_invalid' },
  });
});

function link(overrides: Partial<ChannelStorageLinkEntity>): ChannelStorageLinkEntity {
  return {
    id: 'id',
    threadId: 'g1',
    kind: 'drive',
    googleEmail: null,
    resourceId: 'r',
    url: 'u',
    label: 'zalobot/g1',
    displayName: null,
    firstUsedAt: new Date('2026-01-01T00:00:00Z'),
    lastUsedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

void test('ChannelStorageLinkService finds every row shown as the same link, within the thread only', async () => {
  const rows = [
    link({ id: 'legacy', resourceId: 'u-x', url: 'u-x' }),
    link({ id: 'real', resourceId: 'folder-x', url: 'u-x' }),
    link({ id: 'other', resourceId: 'folder-y', url: 'u-y' }),
    link({ id: 'foreign', threadId: 'g2', resourceId: 'folder-x', url: 'u-x' }),
  ];
  const matches = (row: ChannelStorageLinkEntity, where: Partial<ChannelStorageLinkEntity>) =>
    Object.entries(where).every(
      ([key, value]) => row[key as keyof ChannelStorageLinkEntity] === value,
    );
  const repo = {
    findOne: ({ where }: { where: Partial<ChannelStorageLinkEntity> }) =>
      Promise.resolve(rows.find((row) => matches(row, where)) ?? null),
    find: ({ where }: { where: Partial<ChannelStorageLinkEntity> }) =>
      Promise.resolve(rows.filter((row) => matches(row, where))),
  } as unknown as Repository<ChannelStorageLinkEntity>;
  const service = new ChannelStorageLinkService(repo);

  const group = await service.findLinkGroup('g1', 'real');
  assert.deepEqual(
    group.map((row) => row.id),
    ['legacy', 'real'],
  );
  assert.deepEqual(await service.findLinkGroup('g2', 'real'), []);
});

void test('ChannelStorageLinkService applies an edit to every row of the link with entity saves', async () => {
  let saved: ChannelStorageLinkEntity[] = [];
  let removed: ChannelStorageLinkEntity[] = [];
  const repo = {
    save: (entities: ChannelStorageLinkEntity[]) => {
      saved = entities;
      return Promise.resolve(entities);
    },
    remove: (entities: ChannelStorageLinkEntity[]) => {
      removed = entities;
      return Promise.resolve(entities);
    },
  } as unknown as Repository<ChannelStorageLinkEntity>;
  const service = new ChannelStorageLinkService(repo);
  const group = [link({ id: 'a', googleEmail: 'keep@gmail.com' }), link({ id: 'b' })];

  await service.updateLinkGroup(group, { displayName: 'Kho nhà', url: 'u-new' });
  assert.deepEqual(
    saved.map((row) => [row.id, row.displayName, row.url, row.googleEmail]),
    [
      ['a', 'Kho nhà', 'u-new', 'keep@gmail.com'],
      ['b', 'Kho nhà', 'u-new', null],
    ],
  );

  await service.removeLinkGroup(group);
  assert.deepEqual(
    removed.map((row) => row.id),
    ['a', 'b'],
  );
});

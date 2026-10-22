import assert from 'node:assert/strict';
import test from 'node:test';
import { GooglePhotosService } from './google-photos.service';
import { GoogleAuthService } from './google-auth.service';

void test('GooglePhotosService throws BadRequestException when unauthorized', async () => {
  const mockAuthService = {
    getOAuth2Client: (): null => null,
    isAuthorized: () => false,
  } as unknown as GoogleAuthService;

  const service = new GooglePhotosService(mockAuthService);

  assert.equal(service.isAuthorized(), false);
  await assert.rejects(
    async () => service.uploadBytes(Buffer.from('test'), 'test.jpg'),
    /chưa được kết nối/,
  );
});

void test('GooglePhotosService uploads photo and creates media item in album', async () => {
  const mockAuthService = {
    getOAuth2Client: () => ({
      getAccessToken: async () => {
        await Promise.resolve();
        return { token: 'mock_access_token' };
      },
    }),
    isAuthorized: () => true,
  } as unknown as GoogleAuthService;

  const service = new GooglePhotosService(mockAuthService);

  // Mock global fetch for Google Photos API endpoints
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      await Promise.resolve();
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.endsWith('/uploads')) {
        return new Response('mock_upload_token_xyz', { status: 200 });
      }
      if (urlStr.endsWith('/albums') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            id: 'album_id_bills_123',
            title: 'ZaloBot - Hóa đơn',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (urlStr.includes('/albums?') || urlStr.endsWith('/albums')) {
        return new Response(JSON.stringify({ albums: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.endsWith('/mediaItems:batchCreate')) {
        return new Response(
          JSON.stringify({
            newMediaItemResults: [
              {
                status: { message: 'Success' },
                mediaItem: {
                  id: 'media_item_789',
                  productUrl: 'https://photos.google.com/photo/media_item_789',
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('Not found', { status: 404 });
    };

    const buffer = Buffer.from('photo-bytes');
    const result = await service.uploadBillPhoto(buffer, 'sender_456', {
      note: 'Ăn tối Highlands',
      occurredAt: new Date('2026-10-12T19:00:00Z'),
    });

    assert.equal(result.mediaItemId, 'media_item_789');
    assert.equal(result.albumTitle, 'ZaloBot - Hóa đơn');
    assert.equal(result.productUrl, 'https://photos.google.com/photo/media_item_789');

    // Test uploadGeneralPhoto with custom albumTitle
    const customResult = await service.uploadGeneralPhoto(buffer, 'sender_456', {
      albumTitle: 'Gia đình nhà ông Bảo Duyên - Zalo Photos',
    });
    assert.equal(customResult.albumTitle, 'Gia đình nhà ông Bảo Duyên - Zalo Photos');
    assert.equal(customResult.mediaItemId, 'media_item_789');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('GooglePhotosService finds an album beyond the first page instead of creating a duplicate', async () => {
  const client = {
    getAccessToken: () => Promise.resolve({ token: 'token' }),
  };
  const mockAuthService = {
    getOAuth2Client: () => client,
    isAuthorized: () => true,
  } as unknown as GoogleAuthService;
  const service = new GooglePhotosService(mockAuthService);

  const listCalls: string[] = [];
  let created = false;
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if (init?.method === 'POST') {
        created = true;
        return Promise.resolve(new Response(JSON.stringify({ id: 'dup' }), { status: 200 }));
      }
      listCalls.push(urlStr);
      const body = urlStr.includes('pageToken=p2')
        ? { albums: [{ id: 'album-2', title: '[Zalo] Nhà', productUrl: 'https://photos/a2' }] }
        : { albums: [{ id: 'album-1', title: 'Khác' }], nextPageToken: 'p2' };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    };

    const album = await service.getOrCreateAlbumInfo('[Zalo] Nhà');
    assert.deepEqual(album, { id: 'album-2', url: 'https://photos/a2' });
    assert.equal(created, false);
    assert.equal(listCalls.length, 2);

    // Cached per account: no second listing for the same client.
    await service.getOrCreateAlbumInfo('[Zalo] Nhà');
    assert.equal(listCalls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test('GooglePhotosService does not reuse album ids cached for another Google account', async () => {
  let client = { getAccessToken: () => Promise.resolve({ token: 'a' }) };
  const mockAuthService = {
    getOAuth2Client: () => client,
    isAuthorized: () => true,
  } as unknown as GoogleAuthService;
  const service = new GooglePhotosService(mockAuthService);

  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (_url: string | URL | Request, init?: RequestInit) => {
      const auth = new Headers(init?.headers).get('Authorization');
      const id = auth === 'Bearer a' ? 'album-a' : 'album-b';
      return Promise.resolve(
        new Response(JSON.stringify({ albums: [{ id, title: 'T', productUrl: `u-${id}` }] }), {
          status: 200,
        }),
      );
    };

    assert.equal(await service.getOrCreateAlbum('T'), 'album-a');
    // A login builds a new OAuth client for the new account.
    client = { getAccessToken: () => Promise.resolve({ token: 'b' }) };
    assert.equal(await service.getOrCreateAlbum('T'), 'album-b');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { GooglePhotosService, isAlbumRejection } from './google-photos.service';
import { GoogleAuthService } from './google-auth.service';

interface FetchCall {
  url: string;
  method: string;
  body?: string;
}

const urlOf = (url: string | URL | Request): string =>
  typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const mediaCreated = (id: string): Response =>
  json({ newMediaItemResults: [{ mediaItem: { id, productUrl: `https://photos/${id}` } }] });

/** Replaces `fetch` for the duration of `run`, recording every call. */
async function withFetch(
  respond: (call: FetchCall) => Response,
  run: (calls: FetchCall[]) => Promise<void>,
): Promise<void> {
  const calls: FetchCall[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url: string | URL | Request, init?: RequestInit) => {
    const call = {
      url: urlOf(url),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : undefined,
    };
    calls.push(call);
    return Promise.resolve(respond(call));
  };
  try {
    await run(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const authorizedService = (): GooglePhotosService => {
  const client = { getAccessToken: () => Promise.resolve({ token: 'token' }) };
  const mockAuthService = {
    getOAuth2Client: () => client,
    isAuthorized: () => true,
  } as unknown as GoogleAuthService;
  return new GooglePhotosService(mockAuthService);
};

const isAlbumRequest = (call: FetchCall): boolean => /\/albums(\?|$)/.test(call.url);

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

void test('GooglePhotosService adds media to the given album without listing or creating albums', async () => {
  const service = authorizedService();

  await withFetch(
    (call) => {
      if (call.url.endsWith('/uploads')) return new Response('upload-token', { status: 200 });
      if (call.url.endsWith('/mediaItems:batchCreate')) return mediaCreated('media-1');
      return new Response('Not found', { status: 404 });
    },
    async (calls) => {
      const album = { id: 'album-1', title: '[Zalo] Nhà', url: 'https://photos/album-1' };
      const bill = await service.uploadBillPhoto(Buffer.from('x'), 'sender_456', {
        album,
        note: 'Ăn tối Highlands',
        occurredAt: new Date('2026-10-12T19:00:00Z'),
      });

      assert.equal(bill.mediaItemId, 'media-1');
      assert.equal(bill.albumId, 'album-1');
      assert.equal(bill.albumTitle, '[Zalo] Nhà');
      assert.equal(bill.albumUrl, 'https://photos/album-1');
      assert.equal(bill.productUrl, 'https://photos/media-1');

      const batch = calls.find((c) => c.url.endsWith('/mediaItems:batchCreate'));
      const batchBody = JSON.parse(batch?.body ?? '{}') as { albumId?: string };
      assert.equal(batchBody.albumId, 'album-1');
      assert.equal(calls.filter(isAlbumRequest).length, 0);
    },
  );
});

void test('GooglePhotosService.createAlbum creates the album without looking one up', async () => {
  const service = authorizedService();

  await withFetch(
    () => json({ id: 'album-new', title: '[Zalo] Nhà', productUrl: 'https://photos/new' }),
    async (calls) => {
      const album = await service.createAlbum('[Zalo] Nhà');

      assert.deepEqual(album, { id: 'album-new', url: 'https://photos/new' });
      assert.deepEqual(
        calls.map((c) => c.method),
        ['POST'],
      );
      assert.deepEqual(JSON.parse(calls[0].body ?? '{}'), { album: { title: '[Zalo] Nhà' } });
    },
  );
});

void test('isAlbumRejection only blames the album when Google points at it', () => {
  assert.equal(isAlbumRejection(404, 'Requested entity was not found.'), true);
  assert.equal(isAlbumRejection(400, 'Invalid album ID'), true);
  assert.equal(isAlbumRejection(403, 'No permission to add media items to this album.'), true);

  assert.equal(isAlbumRejection(400, 'Request must contain a valid upload token.'), false);
  assert.equal(isAlbumRejection(403, 'Request had insufficient authentication scopes.'), false);
  assert.equal(isAlbumRejection(429, 'Quota exceeded for album writes'), false);
  assert.equal(isAlbumRejection(500, 'Internal error'), false);
});

void test('GooglePhotosService replaces a refused album once and reuses the upload token', async () => {
  const service = authorizedService();
  const replaced: string[] = [];

  await withFetch(
    (call) => {
      if (call.url.endsWith('/uploads')) return new Response('upload-token', { status: 200 });
      const body = JSON.parse(call.body ?? '{}') as { albumId?: string };
      return body.albumId === 'album-old'
        ? json({ error: { message: 'Invalid album ID' } }, 400)
        : mediaCreated('media-2');
    },
    async (calls) => {
      const result = await service.uploadGeneralPhoto(Buffer.from('x'), 'u', {
        album: { id: 'album-old', title: '[Zalo] Nhà' },
        replaceAlbum: (failedAlbumId) => {
          replaced.push(failedAlbumId);
          return Promise.resolve({ id: 'album-new', url: 'https://photos/new' });
        },
      });

      assert.deepEqual(replaced, ['album-old']);
      assert.equal(result.albumId, 'album-new');
      assert.equal(result.albumUrl, 'https://photos/new');
      assert.equal(calls.filter((c) => c.url.endsWith('/uploads')).length, 1);
      assert.equal(calls.filter(isAlbumRequest).length, 0);
    },
  );
});

void test('GooglePhotosService keeps the album when adding media fails for another reason', async () => {
  const service = authorizedService();
  let replacements = 0;

  await withFetch(
    (call) =>
      call.url.endsWith('/uploads')
        ? new Response('upload-token', { status: 200 })
        : new Response('Backend Error', { status: 500 }),
    async (calls) => {
      await assert.rejects(
        service.uploadVideo(Buffer.from('x'), 'u', {
          album: { id: 'album-1', title: '[Zalo] Nhà' },
          replaceAlbum: () => {
            replacements += 1;
            return Promise.resolve({ id: 'album-dup' });
          },
        }),
        /batchCreate failed \(500\)/,
      );

      assert.equal(replacements, 0);
      assert.equal(calls.filter(isAlbumRequest).length, 0);
    },
  );
});

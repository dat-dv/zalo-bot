import assert from 'node:assert/strict';
import test from 'node:test';
import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { GoogleAuthService } from './google-auth.service';
import type { TokenEncryptionService } from './token-encryption.service';
import type { UserTokenEntity } from '../database/entities/user-token.entity';

function createService(initialRows: Partial<UserTokenEntity>[] = []) {
  const rows = new Map<string, Partial<UserTokenEntity>>(
    initialRows.map((row) => [String(row.userId), row]),
  );
  const unmarked: string[] = [];
  const tokenRepo = {
    find: () => Promise.resolve([...rows.values()]),
    delete: ({ userId }: { userId: string }) => {
      rows.delete(userId);
      return Promise.resolve();
    },
    findOne: ({ where }: { where: { userId: string } }) =>
      Promise.resolve(rows.get(where.userId) ?? null),
    create: (data: Partial<UserTokenEntity>) => ({ ...data }),
    save: (entity: Partial<UserTokenEntity>) => {
      rows.set(String(entity.userId), entity);
      return Promise.resolve(entity);
    },
    createQueryBuilder: () => {
      const qb = {
        update: () => qb,
        set: () => qb,
        where: (_sql: string, params: { sharedUserId: string }) => {
          unmarked.push(params.sharedUserId);
          return qb;
        },
        execute: () => Promise.resolve(),
      };
      return qb;
    },
  } as unknown as Repository<UserTokenEntity>;
  const config = {
    getOrThrow: (key: string) => (key === 'appUrl' ? 'https://bot.example' : `${key}-value`),
  } as unknown as ConfigService;
  const encryption = {
    encrypt: (v?: string) => v,
    decrypt: (v?: string) => v,
  } as unknown as TokenEncryptionService;
  return { service: new GoogleAuthService(config, tokenRepo, encryption), rows, unmarked };
}

void test('GoogleAuthService: a token refresh never moves the shared account', async () => {
  const { service } = createService();

  await service.saveTokensForUser('admin-a', { access_token: 'a1' }, { shared: true });
  const sharedClient = service.getSharedOAuth2Client();
  // Another admin's token is refreshed (or saved without a login).
  await service.saveTokensForUser('admin-b', { access_token: 'b1' });

  assert.equal(service.getSharedOAuth2Client(), sharedClient);
  assert.equal(service.getSharedOAuth2Client()?.credentials.access_token, 'a1');
});

void test('GoogleAuthService: a login pins the shared account in the DB and builds a new client', async () => {
  const { service, rows, unmarked } = createService();

  await service.saveTokensForUser('admin-a', { access_token: 'a1' }, { shared: true });
  const before = service.getSharedOAuth2Client();
  await service.saveTokensForUser('admin-a', { access_token: 'a2' }, { shared: true });

  assert.equal(rows.get('admin-a')?.isShared, true);
  assert.deepEqual(unmarked, ['admin-a', 'admin-a']);
  // New client: caches keyed by the old client (email, folder and album ids) are dropped.
  assert.notEqual(service.getSharedOAuth2Client(), before);
  assert.equal(service.getSharedOAuth2Client()?.credentials.access_token, 'a2');
});

void test('GoogleAuthService: a token saved without a login never becomes the shared account', async () => {
  const { service } = createService();

  await service.saveTokensForUser('admin-b', { access_token: 'b1' });

  assert.equal(service.getSharedOAuth2Client(), null);
  assert.equal(service.isSharedAuthorized(), false);
});

void test('GoogleAuthService: preload only pins the token marked is_shared', async () => {
  const { service } = createService([
    { userId: 'admin-a', accessToken: 'a1', isShared: false },
    { userId: 'admin-b', accessToken: 'b1', isShared: true },
  ]);

  await service.onModuleInit();

  assert.equal(service.getSharedOAuth2Client()?.credentials.access_token, 'b1');
});

void test('GoogleAuthService: preload leaves no shared account when none is marked', async () => {
  const { service } = createService([{ userId: 'admin-a', accessToken: 'a1', isShared: false }]);

  await service.onModuleInit();

  assert.equal(service.getSharedOAuth2Client(), null);
});

void test('GoogleAuthService: disconnecting revokes at Google, deletes the token and does not fall back', async () => {
  const { service, rows } = createService();
  await service.saveTokensForUser('admin-a', { access_token: 'a1' }, { shared: true });
  await service.saveTokensForUser('admin-b', { access_token: 'b1' });
  const sharedClient = service.getSharedOAuth2Client();
  assert.ok(sharedClient);
  let revoked = 0;
  Object.assign(sharedClient, {
    revokeCredentials: () => {
      revoked += 1;
      return Promise.resolve();
    },
  });

  await service.disconnectSharedAccount();

  assert.equal(revoked, 1);
  assert.equal(rows.has('admin-a'), false);
  assert.equal(rows.has('admin-b'), true);
  assert.equal(service.getSharedOAuth2Client(), null);
  assert.equal(service.isSharedAuthorized(), false);
});

void test('GoogleAuthService: disconnecting still signs out locally when Google revoke fails', async () => {
  const { service, rows } = createService();
  await service.saveTokensForUser('admin-a', { access_token: 'a1' }, { shared: true });
  const sharedClient = service.getSharedOAuth2Client();
  assert.ok(sharedClient);
  Object.assign(sharedClient, {
    revokeCredentials: () => Promise.reject(new Error('network down')),
  });

  await service.disconnectSharedAccount();

  assert.equal(rows.has('admin-a'), false);
  assert.equal(service.getSharedOAuth2Client(), null);
});

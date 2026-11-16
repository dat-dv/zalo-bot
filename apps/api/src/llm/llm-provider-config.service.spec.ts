import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryFailedError, type Repository } from 'typeorm';
import { encryptSecret, parseEncryptionKey } from '../common/crypto/secret-cipher';
import { LlmProviderEntity } from '../database/entities/llm-provider.entity';
import { LlmProviderConfigService } from './llm-provider-config.service';

const KEY_HEX = 'c'.repeat(64);

/** In-memory stand-in for the TypeORM repository, counting reads to observe the cache. */
function fakeRepository(seed: LlmProviderEntity[] = []) {
  const rows = [...seed];
  let nextId = rows.length + 1;
  const stats = { finds: 0 };
  const clone = (row: LlmProviderEntity) => Object.assign(new LlmProviderEntity(), row);
  const save = (entity: LlmProviderEntity | LlmProviderEntity[]) => {
    const list = Array.isArray(entity) ? entity : [entity];
    for (const item of list) {
      if (rows.some((row) => row.name === item.name && row.id !== item.id)) {
        return Promise.reject(
          new QueryFailedError('INSERT', [], Object.assign(new Error('dup'), { code: '23505' })),
        );
      }
      if (!item.id) {
        item.id = `id-${nextId++}`;
        item.createdAt = new Date(nextId);
      }
      const index = rows.findIndex((row) => row.id === item.id);
      if (index >= 0) rows[index] = clone(item);
      else rows.push(clone(item));
    }
    return Promise.resolve(entity);
  };
  const repository = {
    find: () => {
      stats.finds += 1;
      return Promise.resolve([...rows].sort((a, b) => a.position - b.position).map(clone));
    },
    findOne: ({ where }: { where: { id: string } }) => {
      const row = rows.find((item) => item.id === where.id);
      return Promise.resolve(row ? clone(row) : null);
    },
    create: (data: Partial<LlmProviderEntity>) => Object.assign(new LlmProviderEntity(), data),
    save,
    remove: (entity: LlmProviderEntity) => {
      rows.splice(
        rows.findIndex((row) => row.id === entity.id),
        1,
      );
      return Promise.resolve(entity);
    },
    createQueryBuilder: () => ({
      select: () => ({
        getRawOne: () =>
          Promise.resolve({
            max: rows.length ? Math.max(...rows.map((row) => row.position)) : null,
          }),
      }),
    }),
    manager: {
      transaction: (work: (manager: { save: typeof save }) => Promise<unknown>) => work({ save }),
    },
  } as unknown as Repository<LlmProviderEntity>;
  return { repository, rows, stats };
}

function createService(seed: LlmProviderEntity[] = [], keyHex = KEY_HEX) {
  const fake = fakeRepository(seed);
  const service = new LlmProviderConfigService(
    fake.repository,
    new ConfigService({ security: { encryptionKey: keyHex } }),
  );
  return { service, ...fake };
}

function entity(fields: Partial<LlmProviderEntity> & { id: string; name: string }) {
  return Object.assign(new LlmProviderEntity(), {
    kind: 'gemini',
    baseUrl: null,
    model: 'g',
    apiKey: null,
    enabled: true,
    position: 0,
    createdAt: new Date(0),
    ...fields,
  });
}

void test('create encrypts the key, appends to the chain and never returns the key', async () => {
  const { service, rows } = createService([entity({ id: 'id-a', name: 'router', position: 0 })]);

  const status = await service.create({
    name: 'gemini',
    kind: 'gemini',
    model: 'g',
    apiKey: 'sk-secret',
    enabled: true,
  });

  assert.equal(status.role, 'fallback');
  assert.equal(status.hasApiKey, true);
  assert.equal(status.configured, true);
  assert.doesNotMatch(JSON.stringify(status), /sk-secret/);
  const stored = rows.find((row) => row.name === 'gemini');
  assert.equal(stored?.position, 1);
  assert.match(stored?.apiKey ?? '', /^enc:v1:/);
  const [, gemini] = await service.getChain();
  assert.equal(gemini?.call.apiKey, 'sk-secret');
});

void test('update keeps the key when none is sent, replaces or clears it on request', async () => {
  const key = parseEncryptionKey(KEY_HEX);
  assert.ok(key);
  const { service, rows } = createService([
    entity({ id: 'id-a', name: 'gemini', apiKey: encryptSecret('old', key) }),
  ]);

  await service.update('id-a', { model: 'g2' });
  assert.equal((await service.getChain())[0]?.call.apiKey, 'old');
  assert.equal((await service.getChain())[0]?.call.model, 'g2');

  await service.update('id-a', { apiKey: 'new' });
  assert.equal((await service.getChain())[0]?.call.apiKey, 'new');

  const cleared = await service.update('id-a', { clearApiKey: true });
  assert.equal(cleared.hasApiKey, false);
  assert.equal(cleared.configured, false);
  assert.equal(rows[0]?.apiKey, null);
});

void test('the chain is read once and re-read after each write', async () => {
  const { service, stats } = createService([entity({ id: 'id-a', name: 'gemini' })]);

  await service.getChain();
  await service.getChain();
  assert.equal(stats.finds, 1);

  await service.update('id-a', { enabled: false });
  assert.deepEqual(await service.getChain(), []);
  const statuses = await service.listStatuses();
  assert.equal(statuses[0]?.role, null);
  assert.equal(statuses[0]?.enabled, false);
});

void test('a duplicate name is a conflict', async () => {
  const { service } = createService([entity({ id: 'id-a', name: 'gemini' })]);

  await assert.rejects(
    service.create({ name: 'gemini', kind: 'gemini', model: 'g' }),
    ConflictException,
  );
});

void test('reorder needs every id once and sets roles by the new order', async () => {
  const { service } = createService([
    entity({ id: 'id-a', name: 'router', kind: 'openai', apiKey: null, position: 0 }),
    entity({ id: 'id-b', name: 'gemini', position: 1 }),
  ]);

  await assert.rejects(service.reorder(['id-b']), BadRequestException);
  const statuses = await service.reorder(['id-b', 'id-a']);
  assert.deepEqual(
    statuses.map((status) => [status.name, status.role]),
    [
      ['gemini', 'primary'],
      ['router', 'fallback'],
    ],
  );
});

void test('a key encrypted with another DATA_ENCRYPTION_KEY counts as missing', async () => {
  const otherKey = parseEncryptionKey('d'.repeat(64));
  assert.ok(otherKey);
  const { service } = createService([
    entity({ id: 'id-a', name: 'gemini', apiKey: encryptSecret('k', otherKey) }),
  ]);

  const [status] = await service.listStatuses();
  assert.equal(status?.hasApiKey, true);
  assert.equal(status?.configured, false);
});

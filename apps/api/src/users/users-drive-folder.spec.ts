import test from 'node:test';
import assert from 'node:assert/strict';
import { UsersService } from './users.service';
import { ThreadConfigService } from '../zca/thread-config.service';
import type { UserEntity } from '../database/entities/user.entity';
import type { ZcaThreadConfigEntity } from '../database/entities/zca-thread-config.entity';
import type { Repository } from 'typeorm';

void test('UsersService.saveDriveFolderInfo updates drive folder fields for user', async () => {
  let savedUser: UserEntity | null = null;
  const mockRepo = {
    findOne: () =>
      Promise.resolve({
        id: 'user_123',
        username: 'testuser',
        role: 'user',
      } as UserEntity),
    save: (entity: UserEntity) => {
      savedUser = entity;
      return Promise.resolve(entity);
    },
  } as unknown as Repository<UserEntity>;

  const service = new UsersService(mockRepo);
  await service.saveDriveFolderInfo('user_123', {
    folderId: 'folder_abc',
    folderUrl: 'https://drive.google.com/folder_abc',
    folderPath: 'zalobot/user_123',
  });

  assert.ok(savedUser);
  assert.equal(savedUser.driveFolderId, 'folder_abc');
  assert.equal(savedUser.driveFolderUrl, 'https://drive.google.com/folder_abc');
  assert.equal(savedUser.driveFolderPath, 'zalobot/user_123');
});

void test('ThreadConfigService.saveDriveFolderInfo updates drive folder fields for thread', async () => {
  let savedEntity: ZcaThreadConfigEntity | null = null;
  const mockRepo = {
    findOne: () =>
      Promise.resolve({
        threadId: 'g-thread-123',
        threadType: 'group',
        isListened: true,
      } as ZcaThreadConfigEntity),
    save: (entity: ZcaThreadConfigEntity) => {
      savedEntity = entity;
      return Promise.resolve(entity);
    },
  } as unknown as Repository<ZcaThreadConfigEntity>;

  const service = new ThreadConfigService(mockRepo);
  await service.saveDriveFolderInfo('g-thread-123', {
    folderId: 'folder_xyz',
    folderUrl: 'https://drive.google.com/folder_xyz',
    folderPath: 'zalobot/g-thread-123',
  });

  assert.ok(savedEntity);
  assert.equal(savedEntity.driveFolderId, 'folder_xyz');
  assert.equal(savedEntity.driveFolderUrl, 'https://drive.google.com/folder_xyz');
  assert.equal(savedEntity.driveFolderPath, 'zalobot/g-thread-123');
});

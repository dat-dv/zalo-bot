import assert from 'node:assert/strict';
import test from 'node:test';
import { GoogleDriveService } from './google-drive.service';
import { GoogleAuthService } from './google-auth.service';

void test('GoogleDriveService throws BadRequestException when unauthorized', () => {
  const mockAuthService = {
    getOAuth2Client: (): null => null,
    isAuthorized: () => false,
  } as unknown as GoogleAuthService;

  const service = new GoogleDriveService(mockAuthService);

  assert.equal(service.rootFolderName, 'zalobot');
  assert.equal(service.isAuthorized(), false);
  assert.throws(() => service.getDriveClient(), /chưa được kết nối/);
});

void test('GoogleDriveService ensures folder path and uploads file properly with mock client', async () => {
  interface CreatedFileRecord {
    requestBody?: { name?: string; parents?: string[] };
  }
  const createdFiles: CreatedFileRecord[] = [];
  const permissions: Array<{ requestBody?: { role?: string; type?: string } }> = [];

  const mockDrive = {
    files: {
      list: async (params: { q?: string }) => {
        await Promise.resolve();
        if (params.q?.includes("name = 'zalobot'")) {
          return { data: { files: [{ id: 'folder_root_123', name: 'zalobot' }] } };
        }
        return { data: { files: [] } };
      },
      create: async (params: { requestBody: { name: string; parents?: string[] } }) => {
        await Promise.resolve();
        createdFiles.push(params);
        return {
          data: {
            id: 'file_id_999',
            name: params.requestBody.name,
            webViewLink: 'https://drive.google.com/file/d/file_id_999/view',
            webContentLink: 'https://drive.google.com/file/d/file_id_999/download',
            size: 1024,
          },
        };
      },
    },
    permissions: {
      create: async (params: { requestBody?: { role?: string; type?: string } }) => {
        await Promise.resolve();
        permissions.push(params);
        return { data: { id: 'perm_1' } };
      },
    },
  };

  const mockAuthService = {
    getOAuth2Client: () => ({ credentials: { access_token: 'valid_token' } }),
    isAuthorized: () => true,
  } as unknown as GoogleAuthService;

  const service = new GoogleDriveService(mockAuthService);
  Reflect.set(service, 'getDriveClient', () => mockDrive);

  const buffer = Buffer.from('test-receipt-image');
  const result = await service.uploadReceipt(buffer, 'user_123', {
    note: 'Cà phê sáng',
    occurredAt: new Date('2026-10-12T08:00:00Z'),
  });

  assert.equal(result.fileId, 'file_id_999');
  assert.equal(result.webViewLink, 'https://drive.google.com/file/d/file_id_999/view');
  assert.match(result.name, /^bill_20261012_.*user_123\.jpg$/);
  assert.equal(result.folderPath, 'zalobot/bill/2026-10');
  assert.equal(permissions.length, 1);
  assert.equal(permissions[0].requestBody?.role, 'reader');
});

void test('shareFolderWithUser creates a user permission on the target folder', async () => {
  interface PermissionParams {
    fileId: string;
    requestBody: { emailAddress: string; role: string; type: string };
  }
  const permissionsCreated: PermissionParams[] = [];
  const mockDrive = {
    permissions: {
      create: (params: PermissionParams) => {
        permissionsCreated.push(params);
        return Promise.resolve({ data: { id: 'perm-999' } });
      },
    },
  };

  const service = new GoogleDriveService({
    getOAuth2Client: () => ({ credentials: { access_token: 'token' } }),
    isAuthorized: () => true,
  } as unknown as GoogleAuthService);

  Reflect.set(service, 'ensureFolderPath', () => Promise.resolve('mock-folder-id-123'));
  Reflect.set(service, 'getDriveClient', () => mockDrive);

  const res = await service.shareFolderWithUser('zalobot/g-123', 'user@gmail.com', 'reader');
  assert.equal(res.fileId, 'mock-folder-id-123');
  assert.equal(res.permissionId, 'perm-999');
  assert.equal(permissionsCreated.length, 1);
  assert.equal(permissionsCreated[0].fileId, 'mock-folder-id-123');
  assert.equal(permissionsCreated[0].requestBody.emailAddress, 'user@gmail.com');
  assert.equal(permissionsCreated[0].requestBody.role, 'reader');
  assert.equal(permissionsCreated[0].requestBody.type, 'user');
});

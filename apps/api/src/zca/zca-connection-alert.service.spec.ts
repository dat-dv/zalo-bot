import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import type { UsersService } from '../users/users.service';
import { ZcaConnectionAlertService, formatConnectionAlert } from './zca-connection-alert.service';
import type { ZcaMessengerService } from './zca-messenger.service';
import type { ZcaService } from './zca.service';

void test('alerts go to admins with a Zalo UID, never to the bot itself', async () => {
  const sent: string[] = [];
  const service = new ZcaConnectionAlertService(
    { getOwnId: () => '111' } as Pick<ZcaService, 'getOwnId'> as ZcaService,
    {
      sendMessage: (id: string | number) => {
        sent.push(String(id));
        return Promise.resolve(true);
      },
    } as Pick<ZcaMessengerService, 'sendMessage'> as ZcaMessengerService,
    {
      getAdminUsers: () =>
        Promise.resolve([{ id: '111' }, { id: '222' }, { id: 'dashboard-owner' }]),
    } as unknown as UsersService,
  );

  await service.notifyAdmins({ kind: 'down', state: 'reconnecting', closeCode: 1006 });
  assert.deepEqual(sent, ['222']);
});

void test('the message says what the admin has to do', () => {
  assert.match(
    formatConnectionAlert({ kind: 'down', state: 'session_expired', closeCode: null }),
    /quét lại mã QR/,
  );
  assert.match(formatConnectionAlert({ kind: 'restored', downForMs: 600_000 }), /10 phút/);
});

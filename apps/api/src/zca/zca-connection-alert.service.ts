import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import type { ZcaConnectionAlert } from './zca-connection-supervisor';
import { ZcaMessengerService } from './zca-messenger.service';
import { ZcaService } from './zca.service';

/** Zalo personal UIDs are numeric; `dashboard-owner` and legacy bot ids cannot be messaged. */
const ZALO_UID = /^\d+$/;

/** Words the admin sees; plain text like every other bot message. */
export function formatConnectionAlert(alert: ZcaConnectionAlert): string {
  if (alert.kind === 'restored') {
    const minutes = Math.max(1, Math.round(alert.downForMs / 60_000));
    return `✅ Bot đã nghe tin nhắn lại sau khoảng ${minutes} phút. Tin gửi trong lúc mất kết nối không được xử lý.`;
  }
  switch (alert.state) {
    case 'replaced':
      return '⚠️ Tài khoản bot vừa đăng nhập ở nơi khác nên bot ngừng nghe tin nhắn. Mở trang Zalo & Người dùng để kiểm tra.';
    case 'session_expired':
      return '⚠️ Phiên Zalo của bot có vẻ đã hết hạn. Vào trang Zalo & Người dùng quét lại mã QR.';
    default:
      return '⚠️ Bot đang mất kết nối Zalo hơn 5 phút và vẫn đang tự thử lại.';
  }
}

/** Tells admins about outages. Best effort: with a dead session only the dashboard can show it. */
@Injectable()
export class ZcaConnectionAlertService implements OnModuleInit {
  private readonly logger = new Logger(ZcaConnectionAlertService.name);

  constructor(
    private readonly zcaService: ZcaService,
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly usersService: UsersService,
  ) {}

  public onModuleInit(): void {
    this.zcaService.onConnectionAlert((alert) => void this.notifyAdmins(alert));
  }

  public async notifyAdmins(alert: ZcaConnectionAlert): Promise<void> {
    const text = formatConnectionAlert(alert);
    this.logger.warn(`[ZCA] ${text}`);
    try {
      const ownId = this.zcaService.getOwnId();
      const admins = await this.usersService.getAdminUsers();
      const targets = admins.map((a) => a.id).filter((id) => ZALO_UID.test(id) && id !== ownId);
      await Promise.all(targets.map((id) => this.zcaMessenger.sendMessage(id, text)));
    } catch (err: unknown) {
      this.logger.warn(
        `[ZCA] Could not alert admins: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }
  }
}

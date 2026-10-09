import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { UsersService } from '../../../users/users.service';
import { GoogleAuthService } from '../../../google/google-auth.service';

@Injectable()
export class BanToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.BAN;
  private readonly logger = new Logger(BanToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly usersService: UsersService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isAdmin = this.usersService.isAdmin(context.senderId);

    if (!isAdmin) {
      await this.zaloService.sendMessage(
        context.chatId,
        '⛔ Chỉ Quản trị viên (Admin) mới có quyền khóa tài khoản.',
      );
      return;
    }

    const text = context.text || '';
    const targetId = text.replace(/^\/ban\s*/i, '').trim();

    if (!targetId) {
      await this.zaloService.sendMessage(
        context.chatId,
        'ℹ️ Cú pháp: /ban <zalo_user_id>\n\nVí dụ: /ban 123456789',
      );
      return;
    }

    if (targetId === context.senderId) {
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Bạn không thể tự khóa tài khoản của chính mình.',
      );
      return;
    }

    if (this.usersService.isAdmin(targetId)) {
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Không thể khóa tài khoản của Quản trị viên khác.',
      );
      return;
    }

    try {
      const banned = await this.usersService.banUser(targetId);
      if (!banned) {
        await this.zaloService.sendMessage(
          context.chatId,
          `⚠️ Không tìm thấy người dùng ${targetId} để khóa hoặc người dùng là Admin.`,
        );
        return;
      }

      await this.googleAuthService.revokeUserTokens(targetId);

      await this.zaloService.sendMessage(
        context.chatId,
        `✅ Đã thu hồi quyền sử dụng và xóa bỏ toàn bộ Token Google của tài khoản ${targetId}.`,
      );
    } catch (err) {
      this.logger.error(`Failed to ban user ${targetId}: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Có lỗi xảy ra khi thực hiện lệnh khóa người dùng.',
      );
    }
  }
}

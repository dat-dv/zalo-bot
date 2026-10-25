import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { UsersService } from '../../../users/users.service';
import { TransactionConfirmationService } from '../../confirmation/transaction-confirmation.service';

@Injectable()
export class BanToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.BAN;
  private readonly logger = new Logger(BanToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly usersService: UsersService,
    private readonly confirmationService: TransactionConfirmationService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isAdmin = this.usersService.isAdmin(context.senderId);

    if (!isAdmin) {
      await this.zcaMessenger.sendMessage(context.chatId, '⛔ Chỉ admin mới khoá được tài khoản.');
      return;
    }

    const text = context.text || '';
    const targetId = text.replace(/^\/ban\s*/i, '').trim();

    if (!targetId) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        'Cú pháp: /ban <zalo_user_id>\nVí dụ: /ban 123456789',
      );
      return;
    }

    if (targetId === context.senderId) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        '⚠️ Không tự khoá tài khoản của mình được.',
      );
      return;
    }

    if (this.usersService.isAdmin(targetId)) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        '⚠️ Không khoá được tài khoản admin khác.',
      );
      return;
    }

    try {
      const user = await this.usersService.getUser(targetId);
      const targetName = user ? user.firstName || user.username || undefined : undefined;
      const role = user?.role;

      await this.confirmationService.createPendingBanUser({
        userId: context.senderId,
        chatId: context.chatId,
        rawPrompt: context.text,
        payload: {
          targetUserId: targetId,
          targetName,
          role,
          reason: 'Lệnh khóa tài khoản từ Quản trị viên',
        },
      });
    } catch (err) {
      this.logger.error(`Failed to create pending ban user ${targetId}: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        '⚠️ Chưa tạo được yêu cầu khoá tài khoản, thử lại sau.',
      );
    }
  }
}

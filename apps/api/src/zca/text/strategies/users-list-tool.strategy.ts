import { Injectable, Logger } from '@nestjs/common';
import { UserRole } from '@zalobot/contracts';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZcaMessengerService } from '../../zca-messenger.service';
import { UsersService } from '../../../users/users.service';
import { GoogleAuthService } from '../../../google/google-auth.service';

@Injectable()
export class UsersListToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.USERS;
  private readonly logger = new Logger(UsersListToolStrategy.name);

  constructor(
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly usersService: UsersService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isAdmin = this.usersService.isAdmin(context.senderId);

    if (!isAdmin) {
      await this.zcaMessenger.sendMessage(
        context.chatId,
        '⛔ Chỉ admin mới xem được danh sách người dùng.',
      );
      return;
    }

    try {
      const users = await this.usersService.getUsers();

      if (users.length === 0) {
        await this.zcaMessenger.sendMessage(context.chatId, 'Chưa có người dùng nào.');
        return;
      }

      const userLines = users.map((u, idx) => {
        const isAuth = this.googleAuthService.isAuthorized(u.id);
        const name = u.firstName || u.username || 'Người dùng';
        const role = u.role === UserRole.ADMIN ? 'admin' : 'thành viên';
        const google = isAuth ? 'Google: đã kết nối' : 'Google: chưa kết nối';
        return `${idx + 1}. ${name} (${u.id}) · ${role} · ${google}`;
      });

      const reply =
        `Người dùng (${users.length}):\n` +
        userLines.join('\n') +
        `\nKhoá quyền ai thì gõ /ban <user_id>.`;

      await this.zcaMessenger.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to list users: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(
        context.chatId,
        '⚠️ Chưa lấy được danh sách người dùng, thử lại sau.',
      );
    }
  }
}

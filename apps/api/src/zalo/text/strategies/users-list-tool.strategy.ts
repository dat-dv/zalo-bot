import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { UsersService } from '../../../users/users.service';
import { GoogleAuthService } from '../../../google/google-auth.service';

@Injectable()
export class UsersListToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.USERS;
  private readonly logger = new Logger(UsersListToolStrategy.name);

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
        '⛔ Chỉ Quản trị viên (Admin) mới có quyền xem danh sách người dùng.',
      );
      return;
    }

    try {
      const users = await this.usersService.getUsers();

      if (users.length === 0) {
        await this.zaloService.sendMessage(
          context.chatId,
          '👥 Chưa có người dùng nào được lưu trong cơ sở dữ liệu.',
        );
        return;
      }

      const userLines = users.map((u, idx) => {
        const isAuth = this.googleAuthService.isAuthorized(u.id);
        const name = u.firstName || u.username || 'Người dùng';
        const role = u.role === 'admin' ? '👑 Admin' : '👤 Member';
        const google = isAuth ? 'Google: ✅' : 'Google: ❌';
        return `  ${idx + 1}. ${name} (${u.id}) - ${role} | ${google}`;
      });

      const reply =
        `👥 DANH SÁCH NGƯỜI DÙNG (${users.length})\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        userLines.join('\n') +
        `\n\n💡 Để khóa quyền một người dùng: /ban <user_id>`;

      await this.zaloService.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to list users: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Có lỗi xảy ra khi lấy danh sách người dùng.',
      );
    }
  }
}

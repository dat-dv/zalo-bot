import { Injectable, Logger } from '@nestjs/common';
import type { IDeployNotifyResponse } from '@zalobot/contracts';
import { UsersService } from '../users/users.service';
import { ZaloService } from '../zalo/zalo.service';
import { DeployNotifyDto } from './dto/deploy-notify.dto';

@Injectable()
export class DeployNotifyService {
  private readonly logger = new Logger(DeployNotifyService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly zaloService: ZaloService,
  ) {}

  public async notifyDeploy(dto?: DeployNotifyDto): Promise<IDeployNotifyResponse> {
    const timestamp = new Date().toISOString();
    const adminUsers = await this.usersService.getAdminUsers();

    if (adminUsers.length === 0) {
      this.logger.log(
        'Deploy notification requested, but no admin user exists in the system. Skipping.',
      );
      return {
        status: 'ok',
        notified: false,
        message:
          'Triển khai (deploy) thành công. Hệ thống chưa có Quản trị viên (Admin) nào được cấu hình để nhận thông báo.',
        adminCount: 0,
        timestamp,
      };
    }

    const timeStr = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date());

    const envName = dto?.environment || process.env.NODE_ENV || 'production';

    let text = `🚀 THÔNG BÁO TRIỂN KHAI (DEPLOY) THÀNH CÔNG!\n\n`;
    text += `Chào bạn! Trợ lý Zalo Bot đã được deploy và khởi động thành công trên hệ thống.\n`;
    text += `Hiện bot đang hoạt động bình thường và sẵn sàng phục vụ! ✨\n\n`;
    text += `⏰ Thời gian: ${timeStr}\n`;
    text += `🌐 Môi trường: ${envName}\n`;
    if (dto?.version) {
      text += `📦 Phiên bản: ${dto.version}\n`;
    }
    if (dto?.commit) {
      text += `🔖 Commit: ${dto.commit}\n`;
    }
    if (dto?.branch) {
      text += `🌿 Nhánh: ${dto.branch}\n`;
    }
    if (dto?.deployedBy) {
      text += `👤 Người deploy: ${dto.deployedBy}\n`;
    }
    if (dto?.message) {
      text += `📝 Ghi chú: ${dto.message}\n`;
    }
    text += `\n💡 Bạn có thể gửi tin nhắn hoặc gõ /help để kiểm tra nhé! 🍀`;

    const recipients: string[] = [];
    const sendPromises = adminUsers.map(async (admin) => {
      const recipientLabel = admin.username ? `@${admin.username}` : admin.firstName || admin.id;
      recipients.push(recipientLabel);
      try {
        const ok = await this.zaloService.sendMessage(admin.id, text);
        if (!ok) {
          this.logger.warn(
            `Could not send deploy message to admin ${admin.id} (${recipientLabel})`,
          );
        }
      } catch (err) {
        this.logger.error(
          `Error sending deploy message to admin ${admin.id}: ${(err as Error).message}`,
        );
      }
    });

    await Promise.all(sendPromises);

    this.logger.log(
      `Deploy notification dispatched to ${adminUsers.length} admin(s): ${recipients.join(', ')}`,
    );

    return {
      status: 'ok',
      notified: true,
      message: `Đã gửi thông báo deploy thành công tới ${adminUsers.length} Quản trị viên (Admin).`,
      adminCount: adminUsers.length,
      recipients,
      timestamp,
    };
  }
}

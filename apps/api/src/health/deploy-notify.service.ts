import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IDeployNotifyResponse } from '@zalobot/contracts';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fromApiRoot, fromProjectRoot } from '../config/project-root';
import { UsersService } from '../users/users.service';
import { ZcaMessengerService } from '../zca/zca-messenger.service';
import { DeployNotifyDto } from './dto/deploy-notify.dto';

@Injectable()
export class DeployNotifyService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DeployNotifyService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly configService?: ConfigService,
  ) {}

  public onApplicationBootstrap(): void {
    const notifyOnStartup = (
      this.configService?.get<string>('NOTIFY_ON_STARTUP') ??
      process.env.NOTIFY_ON_STARTUP ??
      ''
    )
      .trim()
      .toLowerCase();

    if (notifyOnStartup === 'false' || notifyOnStartup === '0') {
      this.logger.log('Startup deploy notification is disabled (NOTIFY_ON_STARTUP=false).');
      return;
    }

    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment && notifyOnStartup !== 'true' && notifyOnStartup !== '1') {
      this.logger.log(
        'Startup deploy notification skipped in development mode. Set NOTIFY_ON_STARTUP=true to enable.',
      );
      return;
    }

    // Schedule notification dispatch shortly after startup to allow HTTP server to listen
    setTimeout(() => {
      void this.triggerStartupNotify();
    }, 1500);
  }

  public resolveVersion(): string {
    const envVersion =
      this.configService?.get<string>('APP_VERSION') ??
      process.env.APP_VERSION ??
      process.env.npm_package_version;
    if (envVersion) {
      return envVersion.startsWith('v') ? envVersion : `v${envVersion}`;
    }

    try {
      const apiPkgPath = fromApiRoot('package.json');
      if (fs.existsSync(apiPkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(apiPkgPath, 'utf8')) as { version?: string };
        if (pkg.version) {
          return `v${pkg.version}`;
        }
      }
    } catch {
      // ignore
    }

    try {
      const rootPkgPath = fromProjectRoot('package.json');
      if (fs.existsSync(rootPkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8')) as { version?: string };
        if (pkg.version) {
          return `v${pkg.version}`;
        }
      }
    } catch {
      // ignore
    }

    return 'v1.0.0';
  }

  public resolveGitInfo(): { commit?: string; branch?: string } {
    let commit =
      this.configService?.get<string>('GIT_COMMIT') ??
      process.env.GIT_COMMIT ??
      process.env.COOLIFY_COMMIT_SHA ??
      process.env.COMMIT_SHA;
    let branch =
      this.configService?.get<string>('GIT_BRANCH') ??
      process.env.GIT_BRANCH ??
      process.env.COOLIFY_BRANCH ??
      process.env.BRANCH;

    if (!commit) {
      try {
        commit = execSync('git rev-parse --short HEAD', {
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 1000,
        })
          .toString()
          .trim();
      } catch {
        // ignore
      }
    }

    if (!branch) {
      try {
        branch = execSync('git rev-parse --abbrev-ref HEAD', {
          stdio: ['ignore', 'pipe', 'ignore'],
          timeout: 1000,
        })
          .toString()
          .trim();
      } catch {
        // ignore
      }
    }

    return { commit: commit || undefined, branch: branch || undefined };
  }

  public resolveChangelog(): string[] {
    const candidatePaths = [
      fromProjectRoot('CHANGELOG.md'),
      fromApiRoot('CHANGELOG.md'),
      path.resolve(process.cwd(), 'CHANGELOG.md'),
    ];

    for (const p of candidatePaths) {
      try {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, 'utf8');
          const sections = content.split(/^## /m);
          if (sections.length >= 2) {
            const latestSection = sections[1];
            const lines = latestSection
              .split('\n')
              .slice(1) // skip the version header line
              .map((l) => l.trim())
              .filter((l) => l.startsWith('-') || l.startsWith('*'))
              .map((l) => l.replace(/^[-*]\s*/, '').trim())
              .filter(Boolean);

            if (lines.length > 0) {
              return lines.slice(0, 5);
            }
          }
        }
      } catch {
        // ignore
      }
    }

    return [];
  }

  public async triggerStartupNotify(): Promise<IDeployNotifyResponse | null> {
    const version = this.resolveVersion();
    const gitInfo = this.resolveGitInfo();

    this.logger.log(`Triggering startup deploy notification (version: ${version})...`);
    try {
      return await this.notifyDeploy({
        version,
        commit: gitInfo.commit,
        branch: gitInfo.branch,
        message: 'Hệ thống đã khởi động và sẵn sàng hoạt động.',
      });
    } catch (err) {
      this.logger.error(`Failed to send startup deploy notification: ${(err as Error).message}`);
      return null;
    }
  }

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

    const changelogItems = this.resolveChangelog();
    if (changelogItems.length > 0) {
      text += `\n📋 Nhật ký thay đổi (Changelog):\n`;
      for (const item of changelogItems) {
        text += ` • ${item}\n`;
      }
    }

    text += `\n💡 Bạn có thể gửi tin nhắn hoặc gõ /help để kiểm tra nhé! 🍀`;

    const recipients: string[] = [];
    const sendPromises = adminUsers.map(async (admin) => {
      const recipientLabel = admin.username ? `@${admin.username}` : admin.firstName || admin.id;
      recipients.push(recipientLabel);
      try {
        const ok = await this.zcaMessenger.sendMessage(admin.id, text);
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

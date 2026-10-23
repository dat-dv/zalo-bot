import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Optional,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import {
  type IGoogleStorageAccountStatus,
  type IGoogleStorageLoginResponse,
  type ThreadBotConfig,
} from '@zalobot/contracts';
import {
  assertDashboardAdmin,
  getDashboardUserIdFromBrowser,
  requireDashboardAdmin,
} from '../dashboard-auth/dashboard-user';
import { ReportsTokenService } from '../reports/reports-token.service';
import { GoogleAuthService } from './google-auth.service';
import { GoogleDriveService, GG_DRIVE_ROOT_FOLDER } from './google-drive.service';
import { ChannelStorageLinkService } from '../zca/storage/channel-storage-link.service';
import { UsersService } from '../users/users.service';
import {
  ThreadConfigService,
  getThreadDriveRoot,
  getThreadPhotosAlbumTitle,
  hasLegacyGroupPrefix,
} from '../zca/thread-config.service';
import { ShareDriveDto } from './dto/share-drive.dto';
import {
  isSameDrivePath,
  isValidEmail,
  resolveChannelDriveRoot,
  resolveChannelPhotosAlbumTitle,
} from './channel-storage.util';

const GOOGLE_PHOTOS_HOME = 'https://photos.google.com';

@ApiTags('Google Workspace (Drive, Photos)')
@ApiBearerAuth('bearer-jwt')
@Controller()
export class GoogleResourcesController {
  private readonly logger = new Logger(GoogleResourcesController.name);

  constructor(
    private readonly tokens: ReportsTokenService,
    private readonly authService: GoogleAuthService,
    @Optional() private readonly driveService?: GoogleDriveService,
    @Optional() private readonly storageLinks?: ChannelStorageLinkService,
    @Optional() private readonly usersService?: UsersService,
    @Optional() private readonly threadConfigService?: ThreadConfigService,
  ) {}

  // Drive/Photos partition routes are admin-only: there is no per-channel membership check, so any
  // signed-in user could otherwise share or create another chat's folder.
  @Post('drive/share')
  @ApiOperation({ summary: 'Cấp quyền chia sẻ Google Drive cho thư mục của một channel (Admin)' })
  async shareDrive(@Req() req: Request, @Body() body: ShareDriveDto) {
    this.admin(req);
    if (!this.driveService) {
      throw new BadRequestException('Google Drive service is not available.');
    }
    const email = body.email ? body.email.trim() : '';
    if (!isValidEmail(email)) {
      throw new BadRequestException('Email không hợp lệ.');
    }
    const role = body.role || 'reader';
    const config = await this.threadConfigService?.findStoredConfig?.(body.channelId);
    const folderPath = config
      ? getThreadDriveRoot(config)
      : resolveChannelDriveRoot(body.channelId);

    const shareResult = await this.driveService.shareFolderWithUser(folderPath, email, role);
    let webViewLink: string | undefined;
    try {
      webViewLink = (await this.driveService.getFolderWebLink(folderPath)) || undefined;
    } catch {
      // ignore
    }

    try {
      const folderInfo = { folderId: shareResult.fileId, folderUrl: webViewLink, folderPath };
      if (await this.isGroupChannel(body.channelId)) {
        await this.threadConfigService?.saveDriveFolderInfo(body.channelId, folderInfo);
      } else {
        await this.usersService?.saveDriveFolderInfo(body.channelId, folderInfo);
      }
    } catch (err) {
      this.logger.warn(
        `Could not persist drive folder info for ${body.channelId}: ${(err as Error).message}`,
      );
    }

    return {
      success: true,
      folderPath,
      email,
      role,
      webViewLink,
      permissionId: shareResult.permissionId,
    };
  }

  @Get('drive/folder-link')
  @ApiOperation({ summary: 'Lấy đường link xem thư mục Google Drive (root hoặc channel)' })
  async getDriveFolderLink(
    @Req() req: Request,
    @Query('channelId') channelId?: string,
    @Query('threadName') threadName?: string,
  ) {
    this.admin(req);
    return this.resolveDriveFolderLink(channelId, threadName);
  }

  private async resolveDriveFolderLink(channelId?: string, threadName?: string) {
    if (!this.driveService) {
      return {
        data: {
          folderPath: 'zalobot',
          webViewLink: 'https://drive.google.com',
        },
      };
    }

    let folderPath = GG_DRIVE_ROOT_FOLDER;
    let cachedUrl: string | undefined;

    if (channelId) {
      const config = await this.loadChannelConfig(channelId, threadName);
      // Always the channel root (customFolder or zalobot/<channelId>), the parent of every upload.
      folderPath = config ? getThreadDriveRoot(config) : resolveChannelDriveRoot(channelId);
      cachedUrl =
        config && isSameDrivePath(config.driveFolderPath, folderPath)
          ? config.driveFolderUrl
          : undefined;
    }

    if (cachedUrl) {
      return {
        data: {
          folderPath,
          webViewLink: cachedUrl,
        },
      };
    }

    try {
      const webViewLink = await this.driveService.getFolderWebLink(folderPath);
      if (channelId && webViewLink) {
        const folderInfo = { folderUrl: webViewLink, folderPath };
        if (await this.isGroupChannel(channelId)) {
          void this.threadConfigService?.saveDriveFolderInfo?.(channelId, folderInfo);
        } else {
          void this.usersService?.saveDriveFolderInfo?.(channelId, folderInfo);
        }
      }
      return {
        data: {
          folderPath,
          webViewLink: webViewLink || 'https://drive.google.com',
        },
      };
    } catch {
      return {
        data: {
          folderPath,
          webViewLink: 'https://drive.google.com',
        },
      };
    }
  }

  @Get('drive/open')
  @ApiOperation({ summary: 'Mở trực tiếp thư mục Google Drive của một channel hoặc root' })
  async openDriveFolder(
    @Req() req: Request,
    @Res() res: Response,
    @Query('channelId') channelId?: string,
    @Query('threadName') threadName?: string,
  ): Promise<void> {
    this.browserAdmin(req);
    const result = await this.resolveDriveFolderLink(channelId, threadName);
    const targetUrl = result.data.webViewLink || 'https://drive.google.com';
    res.redirect(targetUrl);
  }

  @Get('photos/album-link')
  @ApiOperation({ summary: 'Lấy đường link xem album Google Photos (chung hoặc của channel)' })
  async getPhotosAlbumLink(
    @Req() req: Request,
    @Query('channelId') channelId?: string,
    @Query('threadName') threadName?: string,
  ) {
    this.admin(req);
    return this.resolvePhotosAlbumLink(channelId, threadName);
  }

  /**
   * The channel's album in the current shared account, as recorded by uploads
   * (`channel_storage_links`), the same one the dashboard marks "in use". Never asks Google (the
   * app cannot list albums) and never trusts the thread config's `photosAlbumUrl`, which may
   * belong to a previous account. There is no system-wide album: no channel opens Google Photos.
   */
  private async resolvePhotosAlbumLink(channelId?: string, threadName?: string) {
    if (!channelId) {
      return { data: { albumTitle: '', webViewLink: GOOGLE_PHOTOS_HOME } };
    }

    const config = await this.loadChannelConfig(channelId, threadName);
    // Same title the media uploads use, so the link opens the album photos actually go to.
    const albumTitle = config
      ? getThreadPhotosAlbumTitle(config)
      : resolveChannelPhotosAlbumTitle(channelId, { threadName });

    try {
      const email = this.storageLinks ? await this.authService.getSharedAccountEmail() : null;
      const album =
        email && this.storageLinks
          ? await this.storageLinks.findAlbum(channelId, email, albumTitle)
          : null;
      return { data: { albumTitle, webViewLink: album?.url || GOOGLE_PHOTOS_HOME } };
    } catch (err: unknown) {
      this.logger.warn(
        `Could not read the Photos album of ${channelId}: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      return { data: { albumTitle, webViewLink: GOOGLE_PHOTOS_HOME } };
    }
  }

  @Get('photos/open')
  @ApiOperation({ summary: 'Mở trực tiếp Album Google Photos của một channel hoặc chung' })
  async openPhotosAlbum(
    @Req() req: Request,
    @Res() res: Response,
    @Query('channelId') channelId?: string,
    @Query('threadName') threadName?: string,
  ): Promise<void> {
    this.browserAdmin(req);
    const result = await this.resolvePhotosAlbumLink(channelId, threadName);
    res.redirect(result.data.webViewLink);
  }

  @Get('google/storage-account')
  @ApiOperation({ summary: 'Tài khoản Google lưu trữ dùng chung (Drive/Photos) đang dùng (Admin)' })
  async getStorageAccount(@Req() req: Request): Promise<{ data: IGoogleStorageAccountStatus }> {
    this.admin(req);
    return { data: await this.storageAccountStatus() };
  }

  @Post('google/storage-account/login')
  @ApiOperation({ summary: 'Tạo link đăng nhập Google làm tài khoản lưu trữ dùng chung (Admin)' })
  startStorageAccountLogin(@Req() req: Request): { data: IGoogleStorageLoginResponse } {
    const adminId = this.admin(req);
    // The callback saves the token under this admin and pins it as the shared account.
    return { data: { authUrl: this.authService.generateAuthUrl(adminId) } };
  }

  @Post('google/storage-account/logout')
  @ApiOperation({ summary: 'Đăng xuất tài khoản Google lưu trữ dùng chung (Admin)' })
  async logoutStorageAccount(@Req() req: Request): Promise<{ data: IGoogleStorageAccountStatus }> {
    this.admin(req);
    await this.authService.disconnectSharedAccount();
    return { data: await this.storageAccountStatus() };
  }

  private async storageAccountStatus(): Promise<IGoogleStorageAccountStatus> {
    const connected = this.authService.isSharedAuthorized();
    return {
      connected,
      email: connected ? await this.authService.getSharedAccountEmail() : null,
      hasStorageScopes: connected && this.authService.hasStorageScopes(),
    };
  }

  private admin(req: Request) {
    return requireDashboardAdmin(req, this.tokens, this.usersService);
  }
  /** `drive/open` and `photos/open` are plain `<a href>` links, so the refresh cookie is accepted. */
  private browserAdmin(req: Request) {
    return assertDashboardAdmin(getDashboardUserIdFromBrowser(req, this.tokens), this.usersService);
  }

  /** Group folders live on the thread config; only 1-1 channels map to a user record. */
  private async loadChannelConfig(
    channelId: string,
    threadName?: string,
  ): Promise<ThreadBotConfig | undefined> {
    if (!this.threadConfigService) return undefined;
    const config = this.threadConfigService.getConfigSync?.(channelId);
    if (config || !threadName || typeof this.threadConfigService.getConfig !== 'function') {
      return config;
    }
    try {
      return await this.threadConfigService.getConfig(channelId, { threadName });
    } catch {
      return undefined;
    }
  }

  private async isGroupChannel(channelId: string): Promise<boolean> {
    if (typeof this.threadConfigService?.isGroupThread === 'function') {
      return this.threadConfigService.isGroupThread(channelId);
    }
    return hasLegacyGroupPrefix(channelId);
  }
}

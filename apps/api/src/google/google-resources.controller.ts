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
import { GooglePhotosService } from './google-photos.service';
import { GoogleDriveService, GG_DRIVE_ROOT_FOLDER } from './google-drive.service';
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

@ApiTags('Google Workspace (Drive, Photos)')
@ApiBearerAuth('bearer-jwt')
@Controller()
export class GoogleResourcesController {
  private readonly logger = new Logger(GoogleResourcesController.name);

  constructor(
    private readonly tokens: ReportsTokenService,
    private readonly authService: GoogleAuthService,
    @Optional() private readonly driveService?: GoogleDriveService,
    @Optional() private readonly photosService?: GooglePhotosService,
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

  private async resolvePhotosAlbumLink(channelId?: string, threadName?: string) {
    let albumTitle = 'ZaloBot - Hình ảnh';
    let cachedUrl: string | undefined;

    if (channelId) {
      const config = await this.loadChannelConfig(channelId, threadName);
      // Same title the media uploads use, so the link opens the album photos actually go to.
      albumTitle = config
        ? getThreadPhotosAlbumTitle(config)
        : resolveChannelPhotosAlbumTitle(channelId, { threadName });
      cachedUrl =
        config && config.photosAlbumTitle?.trim() === albumTitle
          ? config.photosAlbumUrl
          : undefined;
    }

    if (cachedUrl) {
      return {
        data: {
          albumTitle,
          webViewLink: cachedUrl,
        },
      };
    }

    if (!this.photosService) {
      return {
        data: {
          albumTitle,
          webViewLink: 'https://photos.google.com',
        },
      };
    }

    try {
      const albumUrl = await this.photosService.getAlbumLink(albumTitle);
      if (channelId && albumUrl && this.threadConfigService?.savePhotosAlbumInfo) {
        void this.threadConfigService.savePhotosAlbumInfo(channelId, {
          albumUrl,
          albumTitle,
        });
      }
      return {
        data: {
          albumTitle,
          webViewLink: albumUrl || 'https://photos.google.com',
        },
      };
    } catch {
      return {
        data: {
          albumTitle,
          webViewLink: 'https://photos.google.com',
        },
      };
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
    const targetUrl = result.data.webViewLink || 'https://photos.google.com';
    res.redirect(targetUrl);
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

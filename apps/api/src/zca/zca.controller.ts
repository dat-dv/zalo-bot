import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  assertDashboardAdmin,
  getDashboardUserIdFromBrowser,
  requireDashboardAdmin,
} from '../dashboard-auth/dashboard-user';
import { ReportsTokenService } from '../reports/reports-token.service';
import { UsersService } from '../users/users.service';
import { ZcaService, type AvailableThread } from './zca.service';
import { ThreadConfigService } from './thread-config.service';
import { ZcaBotFeatureService } from './zca-bot-feature.service';
import { MediaStorageService } from '../receipt-storage/media-storage.service';
import { ChannelStorageLinkService } from './storage/channel-storage-link.service';
import {
  isCurrentStorageRow,
  toChannelStorageLinksResponse,
  type CurrentChannelStorage,
} from './storage/channel-storage-links.mapper';
import {
  validateChannelStorageLinkCreate,
  validateChannelStorageLinkUpdate,
} from '@zalobot/contracts';
import type {
  ChannelStorageLinkKind,
  ChannelStorageLinksResponse,
  CreateChannelStorageLinkDto,
  UpdateChannelStorageLinkDto,
  ThreadBotConfig,
  UpdateThreadBotConfigDto,
  SyncThreadMediaDto,
  SyncThreadMediaResponse,
  IZcaGroupMembersResponse,
} from '@zalobot/contracts';

/** Admin-only: every route requires a dashboard access token whose user is an admin. */
@ApiTags('zca')
@ApiBearerAuth('bearer-jwt')
@Controller('zca')
export class ZcaController {
  private readonly logger = new Logger(ZcaController.name);

  constructor(
    private readonly zcaService: ZcaService,
    private readonly threadConfigService: ThreadConfigService,
    private readonly tokens: ReportsTokenService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    @Optional()
    @Inject(forwardRef(() => ZcaBotFeatureService))
    private readonly botFeatureService?: ZcaBotFeatureService,
    @Optional()
    @Inject(forwardRef(() => MediaStorageService))
    private readonly mediaStorageService?: MediaStorageService,
    @Optional() private readonly storageLinkService?: ChannelStorageLinkService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Lấy trạng thái kết nối tài khoản Zalo cá nhân (ZCA)' })
  @ApiResponse({ status: 200, description: 'Trạng thái ZCA' })
  public getStatus(@Req() req: Request) {
    this.admin(req);
    return {
      data: {
        loggedIn: this.zcaService.isLoggedIn(),
        ownId: this.zcaService.getOwnId(),
        isListening: this.zcaService.isListenerActive(),
        listenedCount: this.zcaService.getListenedThreadIds().length,
        proxyEnabled: Boolean(process.env.ZCA_PROXY_URL),
        qrStatus: this.zcaService.getQrLoginStatus(),
      },
    };
  }

  @Get('qr')
  @ApiOperation({ summary: 'Xem ảnh mã QR đăng nhập Zalo dạng ảnh PNG' })
  public getQrImage(@Req() req: Request, @Res() res: Response, @Query('key') key?: string): void {
    // Opened via <img src> on the dashboard (refresh cookie) or a link the bot sends to Zalo (?key=).
    if (!this.zcaService.isQrAccessKeyValid(key)) {
      assertDashboardAdmin(getDashboardUserIdFromBrowser(req, this.tokens), this.usersService);
    }
    const buffer = this.zcaService.getLatestQrBuffer();
    if (!buffer) {
      throw new NotFoundException(
        'Chưa có mã QR nào được tạo. Vui lòng gọi POST /api/zca/login-qr hoặc gõ /zalo-login trong bot.',
      );
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.end(buffer);
  }

  @Post('login-qr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bắt đầu luồng đăng nhập qua mã QR' })
  public async loginQr(
    @Req() req: Request,
    @Body() body?: { forceNew?: boolean },
  ): Promise<{
    data: { message: string; qrUrl: string; code: string | null };
  }> {
    this.admin(req);
    this.logger.log(
      `[ZcaController] Nhận yêu cầu POST /api/zca/login-qr (forceNew: ${Boolean(body?.forceNew)})...`,
    );
    let _generatedQrUrl = '';
    let generatedCode: string | null = null;

    // Trigger QR creation with callback
    void this.zcaService
      .startQrLogin(
        {
          onQrGenerated: (url, code) => {
            this.logger.log(`[ZcaController] ✅ Mã QR đã sẵn sàng: ${url}`);
            _generatedQrUrl = url;
            generatedCode = code;
          },
          onScanned: (name) => {
            this.logger.log(
              `[ZcaController] 📱 Người dùng "${name}" đã quét mã QR trên điện thoại!`,
            );
          },
          onExpired: () => {
            this.logger.warn('[ZcaController] ⏰ Mã QR đã hết hạn. Đang tự động làm mới...');
          },
          onDeclined: () => {
            this.logger.warn(
              '[ZcaController] ❌ Người dùng đã từ chối xác nhận đăng nhập trên điện thoại.',
            );
          },
          onSuccess: (ownId) => {
            this.logger.log(`[ZcaController] 🎉 Đăng nhập thành công với tài khoản ID: ${ownId}`);
          },
          onError: (errMsg) => {
            this.logger.error(`[ZcaController] 💥 Đăng nhập thất bại: ${errMsg}`);
          },
        },
        { forceNew: Boolean(body?.forceNew) },
      )
      .catch((err) => {
        this.logger.error(
          `[ZcaController] Lỗi không xử lý được khi chạy startQrLogin: ${err instanceof Error ? err.stack || err.message : String(err)}`,
        );
      });

    // Small wait to allow QR generation
    for (let i = 0; i < 20; i++) {
      if (this.zcaService.getLatestQrBuffer()) {
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    const qrUrl = this.zcaService.getQrImageUrl();

    return {
      data: {
        message: 'Mã QR đã được tạo. Hãy quét mã trên Zalo điện thoại.',
        qrUrl,
        code: this.zcaService.getLatestQrCode() ?? generatedCode,
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng xuất và xóa phiên tài khoản Zalo cá nhân (ZCA)' })
  public async logout(
    @Req() req: Request,
  ): Promise<{ data: { success: boolean; message: string } }> {
    this.admin(req);
    this.logger.log('[ZcaController] Nhận yêu cầu POST /api/zca/logout...');
    const result = await this.zcaService.logout();
    return { data: result };
  }

  @Get('threads')
  @ApiOperation({
    summary: 'Lấy danh sách các nhóm và bạn bè để chọn danh sách lắng nghe',
  })
  public async getThreads(
    @Req() req: Request,
    @Query('refresh') refresh?: string,
  ): Promise<{ data: { threads: AvailableThread[]; fetchedAt: string | null } }> {
    this.admin(req);
    // Without `refresh` the list comes from the Redis directory cache; only refresh calls Zalo.
    const forceRefresh = refresh === 'true' || refresh === '1';
    const threads = await this.zcaService.getAvailableThreads(forceRefresh);
    return { data: { threads, fetchedAt: this.zcaService.getDirectoryFetchedAt() } };
  }

  @Get('listened-threads')
  @ApiOperation({ summary: 'Lấy danh sách ID các cuộc trò chuyện đang được lắng nghe' })
  public getListenedThreads(@Req() req: Request): { data: { threadIds: string[] } } {
    this.admin(req);
    return { data: { threadIds: this.zcaService.getListenedThreadIds() } };
  }

  @Put('listened-threads')
  @ApiOperation({
    summary: 'Cập nhật danh sách ID các cuộc trò chuyện được phép lắng nghe (Whitelist)',
  })
  public async setListenedThreads(
    @Req() req: Request,
    @Body() body: { threadIds: string[] },
  ): Promise<{ data: { success: boolean; count: number; threadIds: string[] } }> {
    this.admin(req);
    const ids = Array.isArray(body?.threadIds) ? body.threadIds : [];
    await this.zcaService.setListenedThreadIds(ids);
    return {
      data: {
        success: true,
        count: ids.length,
        threadIds: this.zcaService.getListenedThreadIds(),
      },
    };
  }

  @Post('listened-threads/toggle')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bật hoặc tắt lắng nghe cho 1 cuộc trò chuyện cụ thể' })
  public async toggleListenedThread(
    @Req() req: Request,
    @Body() body: { threadId: string },
  ): Promise<{ data: { success: boolean; threadId: string; isListened: boolean } }> {
    this.admin(req);
    const isListened = await this.zcaService.toggleListenedThread(body.threadId);
    return {
      data: {
        success: true,
        threadId: body.threadId,
        isListened,
      },
    };
  }

  @Get('thread-configs')
  @ApiOperation({ summary: 'Lấy danh sách cấu hình chi tiết cho các cuộc trò chuyện' })
  public getThreadConfigs(@Req() req: Request): { data: { configs: ThreadBotConfig[] } } {
    this.admin(req);
    return { data: { configs: this.threadConfigService.getAllConfigs() } };
  }

  @Get('thread-configs/:threadId')
  @ApiOperation({ summary: 'Lấy cấu hình chi tiết của 1 cuộc trò chuyện cụ thể' })
  public async getThreadConfig(
    @Req() req: Request,
    @Param('threadId') threadId: string,
  ): Promise<{ data: { config: ThreadBotConfig } }> {
    this.admin(req);
    const config = await this.threadConfigService.getConfig(threadId);
    return { data: { config } };
  }

  @Put('thread-configs/:threadId')
  @ApiOperation({ summary: 'Cập nhật cấu hình tính năng của 1 cuộc trò chuyện cụ thể' })
  public async updateThreadConfig(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Body() body: UpdateThreadBotConfigDto,
  ): Promise<{ data: { config: ThreadBotConfig } }> {
    this.admin(req);
    const config = await this.threadConfigService.updateConfig(threadId, body);
    if (body.isListened !== undefined) {
      const currentListened = new Set(this.zcaService.getListenedThreadIds());
      if (body.isListened) {
        currentListened.add(threadId);
      } else {
        currentListened.delete(threadId);
      }
      await this.zcaService.setListenedThreadIds(Array.from(currentListened));
    }
    return { data: { config } };
  }

  @Delete('thread-configs/:threadId')
  @ApiOperation({
    summary:
      'Xoá hẳn cấu hình của 1 cuộc trò chuyện không còn trong danh bạ Zalo (giữ trí nhớ hội thoại và lịch sử link Drive/Photos)',
  })
  public async deleteThreadConfig(
    @Req() req: Request,
    @Param('threadId') threadId: string,
  ): Promise<{ data: { deleted: true } }> {
    this.admin(req);
    // A chat still in the Zalo directory would come straight back with a default config,
    // so it is refused: stop listening to it instead.
    if (this.zcaService.isInDirectory(threadId)) {
      throw new ConflictException(
        'Cuộc trò chuyện vẫn còn trong danh bạ Zalo. Hãy tắt lắng nghe thay vì xoá.',
      );
    }
    const deleted = await this.threadConfigService.deleteConfig(threadId);
    if (!deleted) throw new NotFoundException('Không tìm thấy cấu hình của cuộc trò chuyện.');
    this.zcaService.forgetThread(threadId);
    return { data: { deleted: true } };
  }

  @Post('threads/:threadId/sync-media')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Quét lịch sử và sao lưu media (ảnh, video, file) của kênh lên Google Drive',
  })
  public async syncThreadMedia(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Body() body?: SyncThreadMediaDto,
  ): Promise<{ data: SyncThreadMediaResponse }> {
    this.admin(req);
    if (!this.botFeatureService) {
      throw new BadRequestException('ZcaBotFeatureService chưa được khởi tạo');
    }
    const result = await this.botFeatureService.syncThreadMediaHistory(threadId, body);
    return { data: result };
  }

  @Get('threads/:threadId/members')
  @ApiOperation({
    summary: 'Danh sách thành viên của một nhóm ZCA, để cấp quyền gọi bot theo nhóm',
  })
  public async getThreadMembers(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Query('refresh') refresh?: string,
  ): Promise<{ data: IZcaGroupMembersResponse }> {
    this.admin(req);
    if (!this.zcaService.isLoggedIn()) {
      throw new BadRequestException('Tài khoản ZCA chưa đăng nhập.');
    }
    const result = await this.zcaService.getGroupMembers(
      threadId,
      refresh === 'true' || refresh === '1',
    );
    if (!result) throw new NotFoundException('Không tìm thấy nhóm Zalo này.');
    return { data: result };
  }

  @Get('threads/:threadId/storage-links')
  @ApiOperation({
    summary:
      'Các thư mục Google Drive và album Google Photos kênh từng dùng, qua mọi tài khoản Google',
  })
  public async getThreadStorageLinks(
    @Req() req: Request,
    @Param('threadId') threadId: string,
  ): Promise<{ data: ChannelStorageLinksResponse }> {
    this.admin(req);
    const linkService = this.requireStorageLinkService();
    const current = await this.resolveCurrentStorage(threadId);
    return { data: await this.storageLinksResponse(linkService, threadId, current) };
  }

  @Post('threads/:threadId/storage-links')
  @ApiOperation({
    summary:
      'Thêm tay link một thư mục Drive / album Photos có sẵn vào lịch sử (không tạo gì trên Google)',
  })
  public async createThreadStorageLink(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Body() body?: CreateChannelStorageLinkDto,
  ): Promise<{ data: ChannelStorageLinksResponse }> {
    this.admin(req);
    const linkService = this.requireStorageLinkService();
    const kind: unknown = body?.kind;
    if (!isStorageLinkKind(kind)) {
      throw new BadRequestException('Loại link phải là drive hoặc photos.');
    }

    const rows = await linkService.listForThread(threadId);
    const existingUrls = rows.filter((row) => row.kind === kind).map((row) => row.url);
    const validation = validateChannelStorageLinkCreate(kind, body, existingUrls);
    if ('errors' in validation) {
      if (validation.errors.url === 'url_duplicate') {
        throw new ConflictException('Link này đã có trong danh sách của kênh.');
      }
      const fields = Object.entries(validation.errors).map(([field, code]) => `${field}: ${code}`);
      throw new BadRequestException(`Dữ liệu link không hợp lệ (${fields.join(', ')}).`);
    }

    // A unique-key race with another add or an upload surfaces as 409 (global filter).
    await linkService.createLink({ threadId, kind, link: validation.value });
    const current = await this.resolveCurrentStorage(threadId);
    return { data: await this.storageLinksResponse(linkService, threadId, current) };
  }

  @Patch('threads/:threadId/storage-links/:linkId')
  @ApiOperation({
    summary: 'Sửa tên hiển thị, đường link hoặc email tài khoản của một link Drive/Photos',
  })
  public async updateThreadStorageLink(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Param('linkId') linkId: string,
    @Body() body?: UpdateChannelStorageLinkDto,
  ): Promise<{ data: ChannelStorageLinksResponse }> {
    this.admin(req);
    const linkService = this.requireStorageLinkService();
    const group = await linkService.findLinkGroup(threadId, linkId);
    if (group.length === 0) throw new NotFoundException('Không tìm thấy link lưu trữ của kênh.');

    const validation = validateChannelStorageLinkUpdate(group[0].kind, body ?? {});
    // `ok` does not narrow without strictNullChecks (off in the API tsconfig); `in` does.
    if ('errors' in validation) {
      const fields = Object.entries(validation.errors).map(([field, code]) => `${field}: ${code}`);
      throw new BadRequestException(`Dữ liệu link không hợp lệ (${fields.join(', ')}).`);
    }

    const current = await this.resolveCurrentStorage(threadId);
    const changesUrl = validation.value.url !== undefined && validation.value.url !== group[0].url;
    // Uploads rewrite the URL of the link in use, so an edit there would silently be lost.
    if (changesUrl && group.some((row) => isCurrentStorageRow(row, current))) {
      throw new BadRequestException('Không sửa được đường link đang dùng.');
    }

    await linkService.updateLinkGroup(group, validation.value);
    return { data: await this.storageLinksResponse(linkService, threadId, current) };
  }

  @Delete('threads/:threadId/storage-links/:linkId')
  @ApiOperation({
    summary: 'Gỡ một link Drive/Photos khỏi lịch sử (không xoá dữ liệu trên Google)',
  })
  public async deleteThreadStorageLink(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Param('linkId') linkId: string,
  ): Promise<{ data: ChannelStorageLinksResponse }> {
    this.admin(req);
    const linkService = this.requireStorageLinkService();
    const group = await linkService.findLinkGroup(threadId, linkId);
    if (group.length === 0) throw new NotFoundException('Không tìm thấy link lưu trữ của kênh.');

    const current = await this.resolveCurrentStorage(threadId);
    // The link in use is recorded again on the next upload or dialog open: deleting is pointless.
    if (group.some((row) => isCurrentStorageRow(row, current))) {
      throw new BadRequestException('Không xoá được link đang dùng.');
    }

    await linkService.removeLinkGroup(group);
    return { data: await this.storageLinksResponse(linkService, threadId, current) };
  }

  private requireStorageLinkService(): ChannelStorageLinkService {
    if (!this.storageLinkService) {
      throw new BadRequestException('ChannelStorageLinkService chưa được khởi tạo');
    }
    return this.storageLinkService;
  }

  /**
   * Where new media of the thread goes with the current shared account (recorded on the way, so
   * it is listed even before an upload). Empty when Google is not connected.
   */
  private async resolveCurrentStorage(threadId: string): Promise<CurrentChannelStorage> {
    const target = await this.threadConfigService.getStorageTarget(threadId);
    try {
      return (await this.mediaStorageService?.syncCurrentStorage(target)) ?? {};
    } catch (err: unknown) {
      this.logger.warn(
        `Could not resolve current storage of thread ${threadId}: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      return {};
    }
  }

  private async storageLinksResponse(
    linkService: ChannelStorageLinkService,
    threadId: string,
    current: CurrentChannelStorage,
  ): Promise<ChannelStorageLinksResponse> {
    const rows = await linkService.listForThread(threadId);
    return toChannelStorageLinksResponse(threadId, rows, current);
  }

  private admin(req: Request): string | number {
    return requireDashboardAdmin(req, this.tokens, this.usersService);
  }
}

function isStorageLinkKind(value: unknown): value is ChannelStorageLinkKind {
  return value === 'drive' || value === 'photos';
}

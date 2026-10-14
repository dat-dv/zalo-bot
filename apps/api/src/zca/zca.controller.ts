import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { ZcaService, type AvailableThread } from './zca.service';
import { ThreadConfigService } from './thread-config.service';
import type { ThreadBotConfig, UpdateThreadBotConfigDto } from '@zalobot/contracts';

@ApiTags('zca')
@Controller('zca')
export class ZcaController {
  private readonly logger = new Logger(ZcaController.name);

  constructor(
    private readonly zcaService: ZcaService,
    private readonly threadConfigService: ThreadConfigService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Lấy trạng thái kết nối tài khoản Zalo cá nhân (ZCA)' })
  @ApiResponse({ status: 200, description: 'Trạng thái ZCA' })
  public getStatus() {
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
  public getQrImage(@Res() res: Response): void {
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
  public async loginQr(@Body() body?: { forceNew?: boolean }): Promise<{
    data: { message: string; qrUrl: string; code: string | null };
  }> {
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

    const appUrl = process.env.APP_URL || 'http://localhost:3005';
    const qrUrl = `${appUrl.replace(/\/+$/, '')}/api/zca/qr`;

    return {
      data: {
        message: 'Mã QR đã được tạo. Hãy quét mã trên Zalo điện thoại.',
        qrUrl,
        code: this.zcaService.getLatestQrCode() ?? generatedCode,
      },
    };
  }

  @Get('threads')
  @ApiOperation({
    summary: 'Lấy danh sách các nhóm và bạn bè để chọn danh sách lắng nghe',
  })
  public async getThreads(
    @Query('refresh') refresh?: string,
  ): Promise<{ data: { threads: AvailableThread[] } }> {
    const forceRefresh = refresh === 'true' || refresh === '1';
    const threads = await this.zcaService.getAvailableThreads(forceRefresh);
    return { data: { threads } };
  }

  @Get('listened-threads')
  @ApiOperation({ summary: 'Lấy danh sách ID các cuộc trò chuyện đang được lắng nghe' })
  public getListenedThreads(): { data: { threadIds: string[] } } {
    return { data: { threadIds: this.zcaService.getListenedThreadIds() } };
  }

  @Put('listened-threads')
  @ApiOperation({
    summary: 'Cập nhật danh sách ID các cuộc trò chuyện được phép lắng nghe (Whitelist)',
  })
  public async setListenedThreads(
    @Body() body: { threadIds: string[] },
  ): Promise<{ data: { success: boolean; count: number; threadIds: string[] } }> {
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
    @Body() body: { threadId: string },
  ): Promise<{ data: { success: boolean; threadId: string; isListened: boolean } }> {
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
  public getThreadConfigs(): { data: { configs: ThreadBotConfig[] } } {
    return { data: { configs: this.threadConfigService.getAllConfigs() } };
  }

  @Get('thread-configs/:threadId')
  @ApiOperation({ summary: 'Lấy cấu hình chi tiết của 1 cuộc trò chuyện cụ thể' })
  public async getThreadConfig(
    @Param('threadId') threadId: string,
  ): Promise<{ data: { config: ThreadBotConfig } }> {
    const config = await this.threadConfigService.getConfig(threadId);
    return { data: { config } };
  }

  @Put('thread-configs/:threadId')
  @ApiOperation({ summary: 'Cập nhật cấu hình tính năng của 1 cuộc trò chuyện cụ thể' })
  public async updateThreadConfig(
    @Param('threadId') threadId: string,
    @Body() body: UpdateThreadBotConfigDto,
  ): Promise<{ data: { config: ThreadBotConfig } }> {
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
}


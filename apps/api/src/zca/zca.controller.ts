import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { ZcaService, type AvailableThread } from './zca.service';

@ApiTags('zca')
@Controller('zca')
export class ZcaController {
  constructor(private readonly zcaService: ZcaService) {}

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
  public async loginQr(): Promise<{
    data: { message: string; qrUrl: string; code: string | null };
  }> {
    // Start QR login in background flow if not already running
    let _generatedQrUrl = '';
    let generatedCode: string | null = null;

    // Trigger QR creation with callback
    void this.zcaService
      .startQrLogin({
        onQrGenerated: (url, code) => {
          _generatedQrUrl = url;
          generatedCode = code;
        },
      })
      .catch(() => {});

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
  public async getThreads(): Promise<{ data: { threads: AvailableThread[] } }> {
    const threads = await this.zcaService.getAvailableThreads();
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
}

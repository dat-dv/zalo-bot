import { Injectable, Optional } from '@nestjs/common';
import { AgentInput } from '../../types/agent-input.type';
import { PendingImageActionService } from './pending-image-action.service';
import { PendingImageContext, PendingImageStrategy } from './pending-image.interface';
import { CancelPendingImageStrategy } from './strategies/cancel-pending-image.strategy';
import { StorageUploadPendingImageStrategy } from './strategies/storage-upload-pending-image.strategy';
import { CreateBillPendingImageStrategy } from './strategies/create-bill-pending-image.strategy';

@Injectable()
export class PendingImageActionDispatcher {
  private readonly strategies: PendingImageStrategy[] = [];

  constructor(
    @Optional() cancelStrategy?: CancelPendingImageStrategy,
    @Optional() storageUploadStrategy?: StorageUploadPendingImageStrategy,
    @Optional() createBillStrategy?: CreateBillPendingImageStrategy,
    @Optional() private readonly pendingImageActionService?: PendingImageActionService,
  ) {
    if (cancelStrategy) this.strategies.push(cancelStrategy);
    if (storageUploadStrategy) this.strategies.push(storageUploadStrategy);
    if (createBillStrategy) this.strategies.push(createBillStrategy);
  }

  /**
   * Đăng ký thêm strategy tuỳ chỉnh (hỗ trợ mở rộng runtime / testing)
   */
  public registerStrategy(strategy: PendingImageStrategy): void {
    this.strategies.push(strategy);
  }

  /**
   * Điều phối phản hồi từ người dùng cho hình ảnh đang chờ xử lý.
   * Duyệt qua các strategy đã đăng ký, nếu có strategy phù hợp thì thực thi.
   * @returns true nếu có strategy nhận xử lý, false nếu không
   */
  public async dispatch(
    input: AgentInput,
    senderId: string,
    chatId: string,
    displayName: string | undefined,
    text: string,
  ): Promise<boolean> {
    if (!this.pendingImageActionService) return false;

    const pending = await this.pendingImageActionService.getPending(senderId);
    if (!pending) return false;

    const context: PendingImageContext = {
      input,
      senderId,
      chatId,
      displayName,
      text,
      pending,
    };

    for (const strategy of this.strategies) {
      if (strategy.canHandle(text)) {
        return strategy.execute(context);
      }
    }

    // Nếu người dùng nhắn nội dung khác (không chọn 1, 2 hay lệnh hủy):
    // Tự động xóa pending ảnh và cho người dùng làm tiếp cuộc trò chuyện bình thường.
    await this.pendingImageActionService.clearPending(senderId);
    return false;
  }
}

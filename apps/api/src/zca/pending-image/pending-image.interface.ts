import { PendingImageAction } from './pending-image-action.service';
import { AgentInput } from '../../types/agent-input.type';

export interface PendingImageContext {
  input: AgentInput;
  senderId: string;
  chatId: string;
  displayName?: string;
  text: string;
  pending: PendingImageAction;
}

export interface PendingImageStrategy {
  /**
   * Kiểm tra xem chiến lược này có xử lý được câu lệnh / phản hồi từ người dùng không
   */
  canHandle(text: string): boolean;

  /**
   * Thực thi hành động tương ứng với hình ảnh đang chờ
   * @returns true nếu đã xử lý thành công, false nếu không xử lý
   */
  execute(context: PendingImageContext): Promise<boolean>;
}

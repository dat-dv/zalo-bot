import type { LlmToolDefinition } from '../../llm/types/llm.types';
import { parseTargetUsers } from '../../reminders/reminder-target';
import type { PendingAction } from '../confirmation/transaction-confirmation.service';
import { pendingToolArgs } from './pending-edit-args.util';

/**
 * Not a `TextToolType`: it has no strategy. `TextInputService` handles it by re-issuing the
 * chosen pending card through the edit flow.
 */
export const AMEND_PENDING_TOOL_NAME = 'AMEND_PENDING';

export const AMEND_PENDING_TOOL: LlmToolDefinition = {
  name: AMEND_PENDING_TOOL_NAME,
  description:
    'Sửa hoặc bổ sung một thẻ đang chờ xác nhận của chính người nhắn (đổi giờ, thêm/bớt người ' +
    'được nhắc, "tag @ai đó", sửa tiêu đề, thêm ghi chú...) thay vì tạo yêu cầu mới.',
  parameters: {
    type: 'OBJECT',
    properties: {
      code: { type: 'STRING', description: 'Mã 3 số của thẻ đang chờ cần sửa.' },
    },
    required: ['code'],
  },
};

function describePending(pending: PendingAction): string {
  const args = pendingToolArgs(pending.actionType, pending.payload) ?? pending.payload;
  const people = parseTargetUsers(pending.payload.remindUsers) ?? [];
  const peopleText =
    people.length > 0 ? ` · đang nhắc: ${people.map((user) => `@${user.name}`).join(', ')}` : '';
  return (
    `- Mã ${pending.code} · ${pending.actionType} · ${pending.title} · tham số: ` +
    `${JSON.stringify(args)}${peopleText}`
  );
}

/**
 * Prompt block listing the sender's pending cards in this chat, so a follow-up message
 * ("tag @Nam nha") amends its card instead of asking for a second one.
 */
export function amendablePendingBlock(pendings: readonly PendingAction[]): string {
  if (pendings.length === 0) return '';
  return (
    '\n\nTHẺ ĐANG CHỜ XÁC NHẬN CỦA NGƯỜI NHẮN (trong cuộc chat này):\n' +
    pendings.map(describePending).join('\n') +
    '\nQuy tắc:\n' +
    `- Nếu tin nhắn hiện tại sửa hoặc bổ sung một thẻ ở trên (đổi giờ, thêm/bớt người được nhắc, "tag @ai đó", sửa tiêu đề, thêm ghi chú...), gọi ${AMEND_PENDING_TOOL_NAME} với mã của thẻ đó và KHÔNG gọi lại công cụ tạo mới cho thẻ đó. Ví dụ: "tag @Nam nha", "đổi sang 10h", "thêm ghi chú mang laptop".\n` +
    '- Nếu tin nhắn là một yêu cầu mới, độc lập (một việc, khoản chi, lời nhắc khác), gọi công cụ tương ứng như bình thường. Ví dụ: đang chờ thẻ "mua sữa" mà nhắn "thêm việc mua bánh" là yêu cầu mới.'
  );
}

/** The card an amend call targets: its code, or the only card when the code is missing or wrong. */
export function pickAmendTarget(
  pendings: readonly PendingAction[],
  code: unknown,
): PendingAction | undefined {
  const wanted =
    typeof code === 'string' ? code.trim() : typeof code === 'number' ? String(code) : '';
  return (
    pendings.find((pending) => pending.code === wanted) ??
    (pendings.length === 1 ? pendings[0] : undefined)
  );
}

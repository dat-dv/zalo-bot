import type { IContactUserSyncSuggestion } from '@zalobot/contracts';
import type { DebtContactEntity } from '../database/entities/debt-contact.entity';
import type { UserEntity } from '../database/entities/user.entity';

const blank = (value?: string | null): boolean => !value?.trim();

/**
 * Lưu dự phòng số điện thoại giữa Người liên quan và tài khoản User đã gắn (Zalo hay ẩn số):
 * chỉ điền vào phía đang trống, không bao giờ ghi đè. Trả về giá trị cần ghi cho từng phía.
 */
export function fillMissingPhones(
  contactPhone?: string | null,
  userPhone?: string | null,
): { contactPhone?: string; userPhone?: string } {
  if (blank(contactPhone) && !blank(userPhone)) return { contactPhone: userPhone?.trim() };
  if (blank(userPhone) && !blank(contactPhone)) return { userPhone: contactPhone?.trim() };
  return {};
}

export function userDisplayName(user: UserEntity): string {
  return user.firstName?.trim() || user.username?.trim() || `Zalo ${user.id.slice(-4)}`;
}

export interface ContactUserSyncPlan {
  create: { user: UserEntity; displayName: string }[];
  /** Cặp đã gắn sẵn, chỉ cần đồng bộ số điện thoại. */
  linked: { user: UserEntity; contact: DebtContactEntity }[];
  suggestions: IContactUserSyncSuggestion[];
}

/**
 * Quyết định thuần (không I/O) cho việc đưa users vào danh bạ công nợ chung (bỏ qua tài khoản bot):
 * - đã có liên hệ gắn user → chỉ đồng bộ số;
 * - có liên hệ CHƯA gắn trùng tên → chỉ gợi ý (tự tạo sẽ biến "cho Trí mượn 30k" thành trùng tên,
 *   tự gắn có thể nhầm người);
 * - còn lại → tạo liên hệ mới gắn user.
 */
export function planContactUserSync(input: {
  users: UserEntity[];
  contacts: DebtContactEntity[];
  isBotAccount: (userId: string) => boolean;
  normalize: (value: string) => string;
}): ContactUserSyncPlan {
  const plan: ContactUserSyncPlan = { create: [], linked: [], suggestions: [] };
  const linkedByUser = new Map<string, DebtContactEntity>();
  for (const contact of input.contacts) {
    if (contact.linkedUserId && !linkedByUser.has(contact.linkedUserId)) {
      linkedByUser.set(contact.linkedUserId, contact);
    }
  }
  const suggestedContactIds = new Set<string>();

  for (const user of input.users) {
    if (input.isBotAccount(user.id)) continue;
    const linked = linkedByUser.get(user.id);
    if (linked) {
      plan.linked.push({ user, contact: linked });
      continue;
    }
    const displayName = userDisplayName(user);
    const normalizedName = input.normalize(displayName);
    const sameName = input.contacts.find(
      (c) =>
        !c.linkedUserId && c.normalizedName === normalizedName && !suggestedContactIds.has(c.id),
    );
    if (sameName) {
      suggestedContactIds.add(sameName.id);
      plan.suggestions.push({
        userId: user.id,
        userName: displayName,
        contactId: sameName.id,
        contactName: sameName.alias
          ? `${sameName.displayName} (${sameName.alias})`
          : sameName.displayName,
      });
      continue;
    }
    plan.create.push({ user, displayName });
  }
  return plan;
}

'use client';

import { useId, useState, type FormEvent } from 'react';
import axios from 'axios';
import { GrantAccessStatus, UserRole, type IUserListItem } from '@zalobot/contracts';
import { useCreateUserMutation, useUpdateUserMutation } from '@/modules/users/api/users-query';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import {
  Modal,
  MODAL_CLOSE_TAP,
  MODAL_FOOTER_TAP,
  MODAL_STICKY_FOOTER,
  MODAL_STICKY_HEADER,
} from '@/shared/ui/modal';

interface UserFormDialogProps {
  /** Edit an existing user; omit to create a new one. */
  user?: IUserListItem;
  /** Prefill for creating a user from a ZCA row that has no `users` record yet. */
  initialId?: string;
  initialName?: string;
  onClose: () => void;
}

const inputClass =
  'mt-1.5 w-full rounded-[3px] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 max-sm:h-10';
const labelClass = 'block text-xs font-semibold uppercase tracking-wider text-slate-500';

function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: unknown }>(err)) {
    const message = err.response?.data?.message;
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

export function UserFormDialog({ user, initialId, initialName, onClose }: UserFormDialogProps) {
  const isEdit = Boolean(user);
  const createMutation = useCreateUserMutation();
  const updateMutation = useUpdateUserMutation();

  const [id, setId] = useState(user?.id ?? initialId ?? '');
  const [name, setName] = useState(user?.firstName ?? initialName ?? '');
  const [phone, setPhone] = useState(user?.phoneNumber ?? '');
  const [role, setRole] = useState<UserRole>(user?.role ?? UserRole.USER);
  const [grantAccess, setGrantAccess] = useState(true);
  const [error, setError] = useState('');
  const titleId = useId();

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedId = id.trim();
    if (!trimmedId) {
      setError('Vui lòng nhập Zalo User ID');
      return;
    }
    try {
      if (user) {
        await updateMutation.mutateAsync({
          id: user.id,
          firstName: name.trim() || undefined,
          phoneNumber: phone.trim() || undefined,
          role,
        });
      } else {
        await createMutation.mutateAsync({
          id: trimmedId,
          firstName: name.trim() || undefined,
          phoneNumber: phone.trim() || undefined,
          role,
          grantAccess: grantAccess ? GrantAccessStatus.GRANTED : GrantAccessStatus.DENIED,
        });
      }
      onClose();
    } catch (err: unknown) {
      setError(
        apiErrorMessage(
          err,
          isEdit
            ? 'Không thể cập nhật người dùng. Vui lòng thử lại.'
            : 'Không thể thêm người dùng. Vui lòng thử lại.',
        ),
      );
    }
  };

  return (
    <Modal
      open
      onDismiss={isPending ? undefined : onClose}
      labelledBy={titleId}
      backdropClassName="bg-black/50 backdrop-blur-sm"
      panelClassName="max-w-md rounded-[3px] border border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div
        className={`${MODAL_STICKY_HEADER} flex items-center justify-between bg-white pt-6 pb-3 dark:bg-slate-900`}
      >
        <h3 id={titleId} className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {isEdit ? 'Sửa thông tin người dùng' : 'Thêm người dùng mới'}
        </h3>
        <button
          aria-label="Đóng"
          className={`rounded-[3px] p-1 ${BUTTON_TONE.ghost} ${MODAL_CLOSE_TAP}`}
          onClick={onClose}
          type="button"
        >
          ✕
        </button>
      </div>

      <form className="mt-4 flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
        {error && (
          <div className="rounded-[3px] bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="user-form-id">
            Zalo User ID {isEdit ? '' : '*'}
          </label>
          <input
            className={`${inputClass} font-mono disabled:bg-slate-100 disabled:text-slate-600 dark:disabled:bg-slate-800/60`}
            disabled={isEdit || Boolean(initialId)}
            id="user-form-id"
            onChange={(e) => setId(e.target.value)}
            placeholder="Ví dụ: effcda102859c1079848"
            required
            type="text"
            value={id}
          />
          {!isEdit && !initialId && (
            <span className="mt-1 block text-xs text-slate-400">
              ID người dùng lấy từ tin nhắn /status hoặc khi bot từ chối.
            </span>
          )}
        </div>

        <div>
          <label className={labelClass} htmlFor="user-form-name">
            Tên hiển thị / Ghi chú
          </label>
          <input
            className={inputClass}
            id="user-form-name"
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Anh Nam (Kế toán), Chị Linh..."
            type="text"
            value={name}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="user-form-phone">
            Số điện thoại
          </label>
          <input
            className={inputClass}
            id="user-form-phone"
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Ví dụ: 0901234567..."
            type="text"
            value={phone}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="user-form-role">
            Vai trò
          </label>
          <select
            className={inputClass}
            id="user-form-role"
            onChange={(e) =>
              setRole(e.target.value === UserRole.ADMIN ? UserRole.ADMIN : UserRole.USER)
            }
            value={role}
          >
            <option value={UserRole.USER}>👤 Thành viên (Member)</option>
            <option value={UserRole.ADMIN}>👑 Quản trị viên (Admin)</option>
          </select>
        </div>

        {!isEdit && (
          <label className="flex cursor-pointer items-center gap-3 pt-1 text-sm font-medium text-slate-700 max-sm:min-h-10 max-sm:pt-0 dark:text-slate-300">
            <input
              checked={grantAccess}
              className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              onChange={(e) => setGrantAccess(e.target.checked)}
              type="checkbox"
            />
            Cấp quyền tương tác ngay
          </label>
        )}

        <div
          className={`${MODAL_STICKY_FOOTER} mt-2 flex items-center justify-end gap-2 bg-white pt-2 pb-6 dark:bg-slate-900`}
        >
          <button
            className={`rounded-[3px] px-4 py-2 text-sm font-medium ${BUTTON_TONE.ghost} ${MODAL_FOOTER_TAP}`}
            onClick={onClose}
            type="button"
          >
            Hủy
          </button>
          <button
            className={`rounded-[3px] px-4 py-2 text-sm font-semibold shadow-sm ${BUTTON_TONE.primary} ${MODAL_FOOTER_TAP}`}
            disabled={isPending}
            type="submit"
          >
            {isPending ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Lưu người dùng'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

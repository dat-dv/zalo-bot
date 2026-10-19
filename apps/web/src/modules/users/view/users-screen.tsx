'use client';

import { useState } from 'react';
import { UserRole, GrantAccessStatus, type IUserListItem } from '@zalobot/contracts';
import {
  useUsersQuery,
  useCreateUserMutation,
  useSetGrantAccessMutation,
  useUpdateUserMutation,
  useSyncUsersWithZcaMutation,
  useDeleteUserMutation,
} from '../api/users-query';

function UserAvatar({ user, name }: { user: IUserListItem; name?: string }) {
  const [imgError, setImgError] = useState(false);

  if (user.avatarUrl && !imgError) {
    return (
      <img
        alt={name || user.firstName || 'Avatar'}
        className="size-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200 dark:ring-slate-700"
        onError={() => setImgError(true)}
        referrerPolicy="no-referrer"
        src={user.avatarUrl}
      />
    );
  }

  const displayName = name || user.firstName || '';
  const initial = displayName.trim().charAt(0).toUpperCase();

  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
      {initial || '👤'}
    </div>
  );
}

export function UsersScreen() {
  const { data: users = [], isLoading, error } = useUsersQuery();
  const createMutation = useCreateUserMutation();
  const setGrantAccessMutation = useSetGrantAccessMutation();
  const updateMutation = useUpdateUserMutation();
  const syncZcaMutation = useSyncUsersWithZcaMutation();
  const deleteMutation = useDeleteUserMutation();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'granted' | 'pending' | 'admin'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync notification
  const [syncMessage, setSyncMessage] = useState('');
  const [syncMessageType, setSyncMessageType] = useState<'success' | 'error'>('success');

  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>(UserRole.USER);
  const [newUserGrantAccess, setNewUserGrantAccess] = useState(true);
  const [formError, setFormError] = useState('');

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<IUserListItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>(UserRole.USER);
  const [editError, setEditError] = useState('');

  const copyToClipboard = (id: string) => {
    void navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenModal = () => {
    setNewUserId('');
    setNewUserName('');
    setNewUserPhone('');
    setNewUserRole(UserRole.USER);
    setNewUserGrantAccess(true);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (u: IUserListItem) => {
    setEditingUser(u);
    setEditName(u.firstName || '');
    setEditPhone(u.phoneNumber || '');
    setEditRole(u.role);
    setEditError('');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = newUserId.trim();
    if (!id) {
      setFormError('Vui lòng nhập Zalo User ID');
      return;
    }
    try {
      await createMutation.mutateAsync({
        id,
        firstName: newUserName.trim() || undefined,
        phoneNumber: newUserPhone.trim() || undefined,
        role: newUserRole,
        grantAccess: newUserGrantAccess ? GrantAccessStatus.GRANTED : GrantAccessStatus.DENIED,
      });
      setIsModalOpen(false);
    } catch (err: unknown) {
      setFormError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Không thể thêm người dùng. Vui lòng thử lại.',
      );
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await updateMutation.mutateAsync({
        id: editingUser.id,
        firstName: editName.trim() || undefined,
        phoneNumber: editPhone.trim() || undefined,
        role: editRole,
      });
      setEditingUser(null);
    } catch (err: unknown) {
      setEditError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Không thể cập nhật người dùng. Vui lòng thử lại.',
      );
    }
  };

  const handleSyncZca = async () => {
    try {
      const res = await syncZcaMutation.mutateAsync();
      setSyncMessage(
        `Đồng bộ ZCA thành công! Đã cập nhật ${res.syncedCount} / ${res.totalUsers} người dùng từ danh bạ Zalo.`,
      );
      setSyncMessageType('success');
      setTimeout(() => setSyncMessage(''), 5000);
    } catch {
      setSyncMessage('Không thể đồng bộ từ ZCA. Hãy đảm bảo bạn đã đăng nhập ZCA ở trang ZCA.');
      setSyncMessageType('error');
      setTimeout(() => setSyncMessage(''), 5000);
    }
  };

  const handleToggleGrantAccess = async (
    id: string,
    currentGrant: GrantAccessStatus,
    isUserAdmin: boolean,
  ) => {
    if (isUserAdmin && currentGrant === GrantAccessStatus.GRANTED) {
      if (
        !confirm(
          'Người dùng này là Quản trị viên (Admin). Bạn có chắc muốn thu hồi quyền truy cập không?',
        )
      ) {
        return;
      }
    }
    const nextGrant =
      currentGrant === GrantAccessStatus.GRANTED
        ? GrantAccessStatus.DENIED
        : GrantAccessStatus.GRANTED;
    await setGrantAccessMutation.mutateAsync({ id, grantAccess: nextGrant });
  };

  const handleDeleteUser = async (id: string, name?: string) => {
    if (confirm(`Bạn có chắc chắn muốn xóa người dùng "${name || id}" khỏi hệ thống không?`)) {
      await deleteMutation.mutateAsync(id);
    }
  };

  // Filter & Search
  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      u.id.toLowerCase().includes(q) ||
      (u.firstName || '').toLowerCase().includes(q) ||
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.alias || '').toLowerCase().includes(q) ||
      (u.phoneNumber || '').toLowerCase().includes(q) ||
      (u.zaloName || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (filter === 'granted') {
      return u.grantAccess === GrantAccessStatus.GRANTED || u.role === UserRole.ADMIN;
    }
    if (filter === 'pending') {
      return u.grantAccess === GrantAccessStatus.DENIED && u.role !== UserRole.ADMIN;
    }
    if (filter === 'admin') {
      return u.role === UserRole.ADMIN;
    }
    return true;
  });

  const totalCount = users.length;
  const grantedCount = users.filter(
    (u) => u.grantAccess === GrantAccessStatus.GRANTED || u.role === UserRole.ADMIN,
  ).length;
  const pendingCount = users.filter(
    (u) => u.grantAccess === GrantAccessStatus.DENIED && u.role !== UserRole.ADMIN,
  ).length;
  const adminCount = users.filter((u) => u.role === UserRole.ADMIN).length;

  return (
    <div className="flex flex-col gap-5 p-1 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Quản lý người dùng
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Duyệt quyền truy cập (Whitelist), quản lý thông tin thành viên và đồng bộ danh bạ từ Zalo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleSyncZca()}
            disabled={syncZcaMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            title="Đồng bộ tên, avatar và SĐT từ danh bạ Zalo cá nhân (ZCA)"
          >
            <svg
              className={`size-4 ${syncZcaMutation.isPending ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>{syncZcaMutation.isPending ? 'Đang đồng bộ...' : 'Đồng bộ ZCA'}</span>
          </button>
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Thêm người dùng</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncMessage && (
        <div
          className={`flex items-center justify-between rounded-xl p-3.5 text-sm font-medium transition ${
            syncMessageType === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{syncMessageType === 'success' ? '✅' : '⚠️'}</span>
            <span>{syncMessage}</span>
          </div>
          <button
            onClick={() => setSyncMessage('')}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Tổng người dùng
          </span>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {totalCount}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Đã cấp quyền (Whitelist)
          </span>
          <div className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            {grantedCount}
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            Chờ phê duyệt
          </span>
          <div className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-300">
            {pendingCount}
          </div>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 shadow-sm dark:border-purple-900/40 dark:bg-purple-950/20">
          <span className="text-xs font-medium text-purple-700 dark:text-purple-400">
            Quản trị viên (Admin)
          </span>
          <div className="mt-2 text-2xl font-bold text-purple-700 dark:text-purple-300">
            {adminCount}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo ID, tên, SĐT, gợi nhớ..."
            className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-9 pr-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === 'all'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            Tất cả ({totalCount})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === 'pending'
                ? 'bg-amber-600 text-white dark:bg-amber-500'
                : 'text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40'
            }`}
          >
            Chờ duyệt ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('granted')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === 'granted'
                ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                : 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
            }`}
          >
            Đã duyệt ({grantedCount})
          </button>
          <button
            onClick={() => setFilter('admin')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === 'admin'
                ? 'bg-purple-600 text-white dark:bg-purple-500'
                : 'text-purple-700 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950/40'
            }`}
          >
            Admin ({adminCount})
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center">
            <div className="size-7 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-500">
            Lỗi tải danh sách người dùng. Vui lòng kiểm tra quyền Admin.
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-3xl">👥</span>
            <h3 className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
              Không tìm thấy người dùng nào
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {search ? 'Thử tìm với từ khóa khác' : 'Chưa có ai gửi tin nhắn tới bot'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Người dùng</th>
                  <th className="px-4 py-3 font-semibold">Zalo User ID</th>
                  <th className="px-4 py-3 font-semibold">Vai trò</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái quyền</th>
                  <th className="px-4 py-3 font-semibold">Ngày kết nối</th>
                  <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map((u) => {
                  const isGranted =
                    u.grantAccess === GrantAccessStatus.GRANTED || u.role === UserRole.ADMIN;
                  const isAdmin = u.role === UserRole.ADMIN;

                  const isGenericName =
                    !u.firstName || u.firstName === 'bạn' || u.firstName === 'Người dùng Zalo';
                  const primaryName =
                    (!isGenericName ? u.firstName : undefined) ||
                    u.alias ||
                    u.displayName ||
                    u.zaloName ||
                    u.firstName ||
                    'Không có tên';
                  const zaloDisplayName = u.displayName || u.zaloName;

                  return (
                    <tr
                      key={u.id}
                      className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      {/* Cột Người dùng */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="relative shrink-0">
                            <UserAvatar user={u} name={primaryName} />
                            {isGranted && (
                              <span
                                className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
                                title="Đã cấp quyền (Whitelist)"
                              />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[280px]">
                                {primaryName}
                              </span>
                              {u.alias && (
                                <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                                  🏷️ Gợi nhớ: {u.alias}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                              {zaloDisplayName && zaloDisplayName !== primaryName && (
                                <span>Zalo: {zaloDisplayName}</span>
                              )}
                              {u.phoneNumber && (
                                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                                  📞 {u.phoneNumber}
                                </span>
                              )}
                              {u.username && <span>@{u.username}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                            {u.id}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(u.id)}
                            title="Sao chép User ID"
                            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                          >
                            {copiedId === u.id ? (
                              <span className="text-xs text-emerald-600">✓</span>
                            ) : (
                              <svg
                                className="size-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                            👑 Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            👤 Thành viên
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {isGranted ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            Đã cấp quyền
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                            <span className="size-1.5 rounded-full bg-amber-500" />
                            Chờ phê duyệt
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-xs text-slate-500">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Sửa thông tin */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(u)}
                            title="Sửa tên hiển thị và số điện thoại"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-400 transition"
                          >
                            <svg
                              className="size-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                          </button>

                          {/* Cấp quyền / Thu hồi */}
                          <button
                            type="button"
                            onClick={() => handleToggleGrantAccess(u.id, u.grantAccess, isAdmin)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                              isGranted
                                ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-red-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                            }`}
                          >
                            {isGranted ? 'Thu hồi' : 'Cấp quyền ✓'}
                          </button>

                          {!isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u.id, primaryName)}
                              title="Xóa người dùng"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 transition"
                            >
                              <svg
                                className="size-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Sửa thông tin người dùng
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="mt-4 flex flex-col gap-4">
              {editError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Zalo User ID
                </label>
                <input
                  type="text"
                  disabled
                  value={editingUser.id}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 font-mono text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Tên hiển thị / Ghi chú
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ví dụ: Anh Nam (Kế toán), Chị Linh..."
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Số điện thoại
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Ví dụ: 0901234567..."
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Vai trò
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value={UserRole.USER}>👤 Thành viên (Member)</option>
                  <option value={UserRole.ADMIN}>👑 Quản trị viên (Admin)</option>
                </select>
              </div>

              <div className="mt-2 flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Thêm người dùng mới
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="mt-4 flex flex-col gap-4">
              {formError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-400">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Zalo User ID *
                </label>
                <input
                  type="text"
                  required
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="Ví dụ: effcda102859c1079848"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <span className="mt-1 block text-xs text-slate-400">
                  ID người dùng lấy từ tin nhắn /status hoặc khi bot từ chối.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Tên hiển thị (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Ví dụ: Anh Nam, Chị Linh..."
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Số điện thoại (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={newUserPhone}
                  onChange={(e) => setNewUserPhone(e.target.value)}
                  placeholder="Ví dụ: 0901234567..."
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Vai trò
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value={UserRole.USER}>👤 Thành viên (Member)</option>
                  <option value={UserRole.ADMIN}>👑 Quản trị viên (Admin)</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="grantAccessCheck"
                  checked={newUserGrantAccess}
                  onChange={(e) => setNewUserGrantAccess(e.target.checked)}
                  className="size-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="grantAccessCheck"
                  className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Cấp quyền truy cập ngay (grantAccess = 1)
                </label>
              </div>

              <div className="mt-2 flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Đang thêm...' : 'Lưu người dùng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

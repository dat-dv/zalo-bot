'use client';

import { useState } from 'react';
import { UserRole, GrantAccessStatus } from '@zalobot/contracts';
import {
  useUsersQuery,
  useCreateUserMutation,
  useSetGrantAccessMutation,
  useDeleteUserMutation,
} from '../api/users-query';

export function UsersScreen() {
  const { data: users = [], isLoading, error } = useUsersQuery();
  const createMutation = useCreateUserMutation();
  const setGrantAccessMutation = useSetGrantAccessMutation();
  const deleteMutation = useDeleteUserMutation();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'granted' | 'pending' | 'admin'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>(UserRole.USER);
  const [newUserGrantAccess, setNewUserGrantAccess] = useState(true);
  const [formError, setFormError] = useState('');

  const copyToClipboard = (id: string) => {
    void navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenModal = () => {
    setNewUserId('');
    setNewUserName('');
    setNewUserRole(UserRole.USER);
    setNewUserGrantAccess(true);
    setFormError('');
    setIsModalOpen(true);
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
    const matchesSearch =
      u.id.toLowerCase().includes(search.toLowerCase()) ||
      (u.firstName || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.username || '').toLowerCase().includes(search.toLowerCase());

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
            Duyệt quyền truy cập (Whitelist) và quản lý thành viên tương tác với Zalo Bot.
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Thêm người dùng
        </button>
      </div>

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
            placeholder="Tìm theo ID hoặc tên..."
            className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-9 pr-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-1.5">
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

                  return (
                    <tr
                      key={u.id}
                      className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                            {(u.firstName || u.id).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {u.firstName || 'Người dùng Zalo'}
                            </div>
                            {u.username && (
                              <div className="text-xs text-slate-400">@{u.username}</div>
                            )}
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
                        <div className="flex items-center justify-end gap-2">
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
                              onClick={() => handleDeleteUser(u.id, u.firstName)}
                              title="Xóa người dùng"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
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

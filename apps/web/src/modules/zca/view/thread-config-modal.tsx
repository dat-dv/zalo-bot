'use client';

import { useState, useEffect } from 'react';
import type { ThreadBotConfig, UpdateThreadBotConfigDto } from '@zalobot/contracts';
import { useUpdateZcaThreadConfigMutation, useZcaThreadConfigQuery } from '../api/zca-query';

interface ThreadConfigModalProps {
  threadId: string;
  threadName: string;
  threadType: 'user' | 'group';
  isOpen: boolean;
  onClose: () => void;
}

export function ThreadConfigModal({
  threadId,
  threadName,
  threadType,
  isOpen,
  onClose,
}: ThreadConfigModalProps) {
  const { data: config, isLoading } = useZcaThreadConfigQuery(isOpen ? threadId : null);
  const updateMutation = useUpdateZcaThreadConfigMutation();

  const [form, setForm] = useState<ThreadBotConfig | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({
        ...config,
        isListened: config.isListened ?? false,
        directInteraction: config.directInteraction || {
          enabled: false,
          requireMention: false,
          triggerPrefix: '',
          allowAiChat: false,
          allowSelf: false,
        },
        mediaBackup: config.mediaBackup || {
          enabled: false,
          uploadImages: false,
          uploadVideos: false,
          customFolder: '',
          fileSuffix: '',
        },
        expenseTracking: config.expenseTracking || {
          enabled: false,
          requireConfirm: false,
        },
        calendarExtraction: config.calendarExtraction || {
          enabled: false,
          requireConfirm: false,
        },
        confirmationRules: config.confirmationRules || {
          allowReactions: false,
          requiredHearts: threadType === 'group' ? 5 : 1,
          timeoutMinutes: 5,
        },
      });
    }
  }, [config, threadType]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;

    const payload: UpdateThreadBotConfigDto = {
      threadName,
      threadType,
      isListened: form.isListened,
      directInteraction: form.directInteraction,
      mediaBackup: form.mediaBackup,
      expenseTracking: form.expenseTracking,
      calendarExtraction: form.calendarExtraction,
      confirmationRules: form.confirmationRules,
    };

    try {
      await updateMutation.mutateAsync({ threadId, data: payload });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm overflow-y-auto"
      role="dialog"
    >
      <div className="relative w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              {threadName ? threadName.charAt(0).toUpperCase() : '?'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {threadName || 'Cuộc trò chuyện'}
                </h3>
                <span
                  className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    threadType === 'group'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                      : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                  }`}
                >
                  {threadType === 'group' ? 'Nhóm' : 'Cá nhân'}
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400">ID: {threadId}</p>
            </div>
          </div>
          <button
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        {isLoading || !form ? (
          <div className="p-8 text-center text-sm text-slate-400">
            Đang tải thông tin cấu hình...
          </div>
        ) : (
          <form
            className="flex flex-col gap-5 p-5 max-h-[75vh] overflow-y-auto"
            onSubmit={handleSave}
          >
            {/* Master Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Kích hoạt Bot lắng nghe (Master Toggle)
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Khi bật, tài khoản Zalo cá nhân sẽ đóng vai trò Bot tiếp nhận và xử lý tin nhắn
                  trong hội thoại này.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  checked={form.isListened}
                  className="peer sr-only"
                  onChange={(e) => setForm({ ...form, isListened: e.target.checked })}
                  type="checkbox"
                />
                <div className="peer h-6 w-11 rounded-full bg-slate-300 peer-checked:bg-emerald-600 peer-focus:outline-none dark:bg-slate-700 after:absolute after:top-[2px] after:left-[2px] after:size-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
              </label>
            </div>

            {/* Feature: Tương tác Bot trực tiếp */}
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Tương tác Bot trực tiếp (AI Trợ lý & Lệnh bot)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Cho phép trò chuyện, hỏi đáp AI, thực hiện lệnh tra cứu và xử lý yêu cầu trực
                      tiếp
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    checked={form.directInteraction?.enabled ?? false}
                    className="peer sr-only"
                    onChange={(e) =>
                      setForm({
                        ...form,
                        directInteraction: {
                          ...form.directInteraction,
                          enabled: e.target.checked,
                          requireMention:
                            form.directInteraction?.requireMention ?? threadType === 'group',
                          triggerPrefix: form.directInteraction?.triggerPrefix ?? '',
                          allowAiChat: form.directInteraction?.allowAiChat ?? true,
                        },
                      })
                    }
                    type="checkbox"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-slate-300 peer-checked:bg-blue-600 peer-focus:outline-none dark:bg-slate-700 after:absolute after:top-[2px] after:left-[2px] after:size-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
                </label>
              </div>

              {(form.directInteraction?.enabled ?? false) && (
                <div className="mt-3.5 flex flex-col gap-3 pl-7">
                  {threadType === 'group' && (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          Bắt buộc tag/mention (@Bot) mới trả lời
                        </span>
                        <p className="text-[10px] text-slate-400">
                          Tránh bot phản hồi tự do gây loãng cuộc trò chuyện của nhóm
                        </p>
                      </div>
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          checked={form.directInteraction?.requireMention ?? threadType === 'group'}
                          className="peer sr-only"
                          onChange={(e) =>
                            setForm({
                              ...form,
                              directInteraction: {
                                ...form.directInteraction,
                                enabled: form.directInteraction?.enabled ?? false,
                                requireMention: e.target.checked,
                              },
                            })
                          }
                          type="checkbox"
                        />
                        <div className="peer h-4 w-7 rounded-full bg-slate-300 peer-checked:bg-blue-600 peer-focus:outline-none dark:bg-slate-700 after:absolute after:top-[1px] after:left-[1px] after:size-3.5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
                      </label>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Cho phép AI trò chuyện tự do (Chit-chat)
                      </span>
                      <p className="text-[10px] text-slate-400">
                        AI sẽ phản hồi tự nhiên cho các câu hỏi tổng quát ngoài các tác vụ tài
                        chính/lịch
                      </p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        checked={form.directInteraction?.allowAiChat ?? false}
                        className="peer sr-only"
                        onChange={(e) =>
                          setForm({
                            ...form,
                            directInteraction: {
                              ...form.directInteraction,
                              enabled: form.directInteraction?.enabled ?? false,
                              requireMention: form.directInteraction?.requireMention ?? false,
                              allowAiChat: e.target.checked,
                            },
                          })
                        }
                        type="checkbox"
                      />
                      <div className="peer h-4 w-7 rounded-full bg-slate-300 peer-checked:bg-blue-600 peer-focus:outline-none dark:bg-slate-700 after:absolute after:top-[1px] after:left-[1px] after:size-3.5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Phản hồi tin nhắn tự gửi (Self-listen / isSelf)
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Cho phép bot phản hồi tin nhắn gửi từ chính tài khoản Zalo của bot (hữu ích
                        khi bạn tự nhắn tin để test bot)
                      </p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        checked={form.directInteraction?.allowSelf ?? false}
                        className="peer sr-only"
                        onChange={(e) =>
                          setForm({
                            ...form,
                            directInteraction: {
                              ...form.directInteraction,
                              enabled: form.directInteraction?.enabled ?? false,
                              requireMention: form.directInteraction?.requireMention ?? false,
                              allowAiChat: form.directInteraction?.allowAiChat ?? false,
                              allowSelf: e.target.checked,
                            },
                          })
                        }
                        type="checkbox"
                      />
                      <div className="peer h-4 w-7 rounded-full bg-slate-300 peer-checked:bg-blue-600 peer-focus:outline-none dark:bg-slate-700 after:absolute after:top-[1px] after:left-[1px] after:size-3.5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Tiền tố gọi bot nhanh (Prefix tùy chọn)
                    </label>
                    <input
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          directInteraction: {
                            ...form.directInteraction,
                            enabled: form.directInteraction?.enabled ?? false,
                            requireMention:
                              form.directInteraction?.requireMention ?? threadType === 'group',
                            triggerPrefix: e.target.value,
                          },
                        })
                      }
                      placeholder="VD: / hoặc ! hoặc bot: (để trống nếu chỉ dùng tag)"
                      type="text"
                      value={form.directInteraction?.triggerPrefix || ''}
                    />
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      Tin nhắn bắt đầu bằng tiền tố này sẽ kích hoạt bot nhanh (mặc định luôn hỗ trợ
                      gọi @Bot)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Feature 1: Tự động lưu trữ tài nguyên (Drive) */}
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📁</span>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Tự động lưu trữ tài nguyên (Google Drive)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tự động bắt hình ảnh, video gửi vào nhóm và đẩy lên Google Drive
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    checked={form.mediaBackup.enabled}
                    className="peer sr-only"
                    onChange={(e) =>
                      setForm({
                        ...form,
                        mediaBackup: {
                          ...form.mediaBackup,
                          enabled: e.target.checked,
                        },
                      })
                    }
                    type="checkbox"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-slate-300 peer-checked:bg-blue-600 peer-focus:outline-none dark:bg-slate-700 after:absolute after:top-[2px] after:left-[2px] after:size-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
                </label>
              </div>

              {form.mediaBackup.enabled && (
                <div className="mt-3.5 flex flex-col gap-3 pl-7">
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        checked={form.mediaBackup.uploadImages}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        onChange={(e) =>
                          setForm({
                            ...form,
                            mediaBackup: {
                              ...form.mediaBackup,
                              uploadImages: e.target.checked,
                            },
                          })
                        }
                        type="checkbox"
                      />
                      Lưu hình ảnh (.jpg, .png)
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        checked={form.mediaBackup.uploadVideos}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        onChange={(e) =>
                          setForm({
                            ...form,
                            mediaBackup: {
                              ...form.mediaBackup,
                              uploadVideos: e.target.checked,
                            },
                          })
                        }
                        type="checkbox"
                      />
                      Lưu video (.mp4)
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Thư mục Google Drive riêng
                      </label>
                      <input
                        className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        onChange={(e) =>
                          setForm({
                            ...form,
                            mediaBackup: {
                              ...form.mediaBackup,
                              customFolder: e.target.value,
                            },
                          })
                        }
                        placeholder="VD: zalobot/Nhom-Ke-Toan"
                        type="text"
                        value={form.mediaBackup.customFolder || ''}
                      />
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        Để trống sẽ lưu vào zalobot/image hoặc zalobot/video
                      </p>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Hậu tố tên file (Suffix)
                      </label>
                      <input
                        className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        onChange={(e) =>
                          setForm({
                            ...form,
                            mediaBackup: {
                              ...form.mediaBackup,
                              fileSuffix: e.target.value,
                            },
                          })
                        }
                        placeholder="VD: _ketoan hoặc _family"
                        type="text"
                        value={form.mediaBackup.fileSuffix || ''}
                      />
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        Tránh trùng tên file khi có nhiều người/nhóm cùng upload
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Feature 2: Phân tích & Ghi nhận Thu - Chi */}
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💰</span>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Phân tích & Quản lý thu chi
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tự động phát hiện tin nhắn chứa giao dịch thu chi và gợi ý ghi sổ
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    checked={form.expenseTracking.enabled}
                    className="peer sr-only"
                    onChange={(e) =>
                      setForm({
                        ...form,
                        expenseTracking: {
                          ...form.expenseTracking,
                          enabled: e.target.checked,
                        },
                      })
                    }
                    type="checkbox"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-slate-300 peer-checked:bg-blue-600 peer-focus:outline-none dark:bg-slate-700 after:absolute after:top-[2px] after:left-[2px] after:size-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
                </label>
              </div>

              {form.expenseTracking.enabled && (
                <div className="mt-3 flex items-center justify-between pl-7">
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    Gửi thẻ hỏi xác nhận trước khi lưu vào hệ thống
                  </span>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      checked={form.expenseTracking.requireConfirm}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          expenseTracking: {
                            ...form.expenseTracking,
                            requireConfirm: e.target.checked,
                          },
                        })
                      }
                      type="checkbox"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">Bắt buộc</span>
                  </label>
                </div>
              )}
            </div>

            {/* Feature 3: Phân tích tin nhắn tạo lịch (Google Calendar) */}
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📅</span>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Phân tích tin nhắn tạo lịch hẹn (Calendar)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tự động phát hiện cuộc hẹn, deadline, lịch họp và gợi ý thêm vào Google
                      Calendar
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    checked={form.calendarExtraction.enabled}
                    className="peer sr-only"
                    onChange={(e) =>
                      setForm({
                        ...form,
                        calendarExtraction: {
                          ...form.calendarExtraction,
                          enabled: e.target.checked,
                        },
                      })
                    }
                    type="checkbox"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-slate-300 peer-checked:bg-blue-600 peer-focus:outline-none dark:bg-slate-700 after:absolute after:top-[2px] after:left-[2px] after:size-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
                </label>
              </div>

              {form.calendarExtraction.enabled && (
                <div className="mt-3 flex items-center justify-between pl-7">
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    Gửi thẻ hỏi xác nhận trước khi thêm vào Google Calendar
                  </span>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      checked={form.calendarExtraction.requireConfirm}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          calendarExtraction: {
                            ...form.calendarExtraction,
                            requireConfirm: e.target.checked,
                          },
                        })
                      }
                      type="checkbox"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-300">Bắt buộc</span>
                  </label>
                </div>
              )}
            </div>

            {/* Feature 4: Quy tắc xác nhận (Reactions & Timeout) */}
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-lg">❤️</span>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Quy tắc xác nhận qua Reaction & Thao tác
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Thả tim (❤️) để duyệt, thả phẫn nộ (😡) hoặc soạn `cancel` để hủy bỏ
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    checked={form.confirmationRules.allowReactions}
                    className="peer sr-only"
                    onChange={(e) =>
                      setForm({
                        ...form,
                        confirmationRules: {
                          ...form.confirmationRules,
                          allowReactions: e.target.checked,
                        },
                      })
                    }
                    type="checkbox"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-slate-300 peer-checked:bg-blue-600 peer-focus:outline-none dark:bg-slate-700 after:absolute after:top-[2px] after:left-[2px] after:size-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
                </label>
              </div>

              {form.confirmationRules.allowReactions && (
                <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 pl-7">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Số tim tối thiểu để duyệt
                    </label>
                    <input
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      max={50}
                      min={1}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          confirmationRules: {
                            ...form.confirmationRules,
                            requiredHearts: Math.max(1, parseInt(e.target.value) || 1),
                          },
                        })
                      }
                      type="number"
                      value={form.confirmationRules.requiredHearts}
                    />
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      Gợi ý: 1 tim cho chat cá nhân, 3 - 5 tim cho nhóm biểu quyết
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Thời gian chờ xác nhận (phút)
                    </label>
                    <input
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      max={60}
                      min={1}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          confirmationRules: {
                            ...form.confirmationRules,
                            timeoutMinutes: Math.max(1, parseInt(e.target.value) || 5),
                          },
                        })
                      }
                      type="number"
                      value={form.confirmationRules.timeoutMinutes}
                    />
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      Hết thời gian yêu cầu sẽ tự động bị hủy
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              {saveSuccess && (
                <span className="text-xs text-emerald-600 font-semibold mr-auto">
                  ✅ Đã lưu cấu hình thành công!
                </span>
              )}
              <button
                className="rounded border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                onClick={onClose}
                type="button"
              >
                Đóng
              </button>
              <button
                className="rounded bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={updateMutation.isPending}
                type="submit"
              >
                {updateMutation.isPending ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

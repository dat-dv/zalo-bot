'use client';

import { useState, useEffect } from 'react';
import type { ThreadBotConfig, UpdateThreadBotConfigDto } from '@zalobot/contracts';
import {
  useUpdateZcaThreadConfigMutation,
  useZcaThreadConfigQuery,
  useGoogleDriveFolderLinkQuery,
} from '../api/zca-query';
import { Modal, MODAL_STICKY_FOOTER, MODAL_STICKY_HEADER } from '@/shared/ui/modal';
import {
  getThreadDriveFolderLabel,
  getThreadDriveLink,
  getThreadPhotosAlbumLabel,
  getThreadPhotosLink,
} from '../api/zca-api';
import { TriggerPrefixInput } from '../presentation/components/trigger-prefix-input';

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
  const { data: driveLinkData } = useGoogleDriveFolderLinkQuery(
    isOpen ? threadId : undefined,
    isOpen ? threadName : undefined,
  );
  const updateMutation = useUpdateZcaThreadConfigMutation();

  const [form, setForm] = useState<ThreadBotConfig | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (config) {
      setForm({
        ...config,
        isListened: config.isListened ?? false,
        driveFolderId: config.driveFolderId,
        driveFolderUrl: config.driveFolderUrl,
        driveFolderPath: config.driveFolderPath,
        photosAlbumId: config.photosAlbumId,
        photosAlbumUrl: config.photosAlbumUrl,
        photosAlbumTitle: config.photosAlbumTitle,
        directInteraction: {
          enabled: config.directInteraction?.enabled ?? false,
          triggerPrefixes: config.directInteraction?.triggerPrefixes ?? [],
          allowAiChat: config.directInteraction?.allowAiChat ?? false,
          allowSelf: config.directInteraction?.allowSelf ?? false,
        },
        mediaBackup: {
          enabled: config.mediaBackup?.enabled ?? false,
          uploadImages: config.mediaBackup?.uploadImages ?? false,
          uploadVideos: config.mediaBackup?.uploadVideos ?? false,
          uploadFiles: config.mediaBackup?.uploadFiles ?? false,
          uploadAudios: config.mediaBackup?.uploadAudios ?? false,
          notifyInThread: config.mediaBackup?.notifyInThread ?? false,
          customFolder: config.mediaBackup?.customFolder || '',
          fileSuffix: config.mediaBackup?.fileSuffix || '',
          photosAlbum: config.mediaBackup?.photosAlbum || '',
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
      driveFolderId: form.driveFolderId,
      driveFolderUrl: form.driveFolderUrl,
      driveFolderPath: form.driveFolderPath,
      photosAlbumId: form.photosAlbumId,
      photosAlbumUrl: form.photosAlbumUrl,
      photosAlbumTitle: form.photosAlbumTitle,
      directInteraction: form.directInteraction,
      mediaBackup: form.mediaBackup,
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
    <Modal
      open
      onDismiss={updateMutation.isPending ? undefined : onClose}
      backdropClassName="bg-slate-900/60 backdrop-blur-sm"
      panelClassName="max-w-2xl rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Header */}
      <div
        className={`${MODAL_STICKY_HEADER} flex items-center justify-between border-b border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800`}
      >
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
        <div className="p-8 text-center text-sm text-slate-400">Đang tải thông tin cấu hình...</div>
      ) : (
        <form className="flex flex-col gap-5 p-5" onSubmit={handleSave}>
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
                        triggerPrefixes: form.directInteraction?.triggerPrefixes ?? [],
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
                <p className="rounded bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                  {threadType === 'group'
                    ? 'Trong nhóm, bot chỉ phản hồi khi được @mention hoặc tin nhắn bắt đầu bằng một tiền tố bên dưới. Ảnh không kèm chữ chỉ được lưu; muốn bot đọc ảnh hãy reply ảnh và @Bot.'
                    : 'Chat riêng với bot: mọi tin nhắn chữ đều được xử lý, không cần @mention. Ảnh không kèm chữ chỉ được lưu.'}
                </p>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Cho phép AI trò chuyện tự do (Chit-chat)
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Khi được gọi (@Bot, tiền tố hoặc chat riêng), AI trả lời tự nhiên cả các câu
                      hỏi tổng quát ngoài tác vụ tài chính/lịch
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

                <TriggerPrefixInput
                  onChange={(triggerPrefixes) =>
                    setForm({
                      ...form,
                      directInteraction: {
                        ...form.directInteraction,
                        enabled: form.directInteraction?.enabled ?? false,
                        triggerPrefixes,
                      },
                    })
                  }
                  value={form.directInteraction?.triggerPrefixes ?? []}
                />
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
              <div className="mt-3.5 flex flex-col gap-3.5 pl-7">
                {/* Google Drive Link Box */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-100 bg-blue-50/60 p-2.5 dark:border-blue-900/50 dark:bg-blue-950/30">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📁</span>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Thư mục Drive:
                        </span>
                        <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] font-medium text-blue-700 border border-blue-200 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300">
                          {getThreadDriveFolderLabel({ id: threadId }, form)}
                        </code>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Tất cả hình ảnh, video, tệp tin từ cuộc trò chuyện này sẽ được lưu tại đây
                      </p>
                    </div>
                  </div>
                  <a
                    className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 transition-colors"
                    href={
                      form.driveFolderUrl ||
                      driveLinkData?.webViewLink ||
                      getThreadDriveLink({ id: threadId, name: threadName }, form)
                    }
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <span>Mở Google Drive</span>
                    <span>↗</span>
                  </a>
                </div>

                {/* Google Photos Album info banner */}
                <div className="flex items-center justify-between rounded-lg border border-indigo-200/80 bg-indigo-50/70 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/30">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">📸</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Album Google Photos:
                        </span>
                        <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] font-medium text-indigo-700 border border-indigo-200 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300">
                          {getThreadPhotosAlbumLabel({ id: threadId, name: threadName }, form)}
                        </code>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        Tự động tạo album riêng trên Google Photos cho cuộc trò chuyện này
                      </p>
                    </div>
                  </div>
                  <a
                    className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors"
                    href={getThreadPhotosLink({ id: threadId, name: threadName }, form)}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <span>Mở Google Photos</span>
                    <span>↗</span>
                  </a>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Loại tài nguyên tự động lưu (Mặc định tắt):
                  </label>
                  <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        checked={form.mediaBackup.uploadImages ?? false}
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
                      📸 Lưu hình ảnh (.jpg, .png)
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        checked={form.mediaBackup.uploadVideos ?? false}
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
                      🎥 Lưu video (.mp4)
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        checked={form.mediaBackup.uploadFiles ?? false}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        onChange={(e) =>
                          setForm({
                            ...form,
                            mediaBackup: {
                              ...form.mediaBackup,
                              uploadFiles: e.target.checked,
                            },
                          })
                        }
                        type="checkbox"
                      />
                      📄 Lưu tài liệu & tệp tin (.pdf, .docx, .xlsx, .zip...)
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        checked={form.mediaBackup.uploadAudios ?? false}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        onChange={(e) =>
                          setForm({
                            ...form,
                            mediaBackup: {
                              ...form.mediaBackup,
                              uploadAudios: e.target.checked,
                            },
                          })
                        }
                        type="checkbox"
                      />
                      🎙️ Lưu tin nhắn thoại & âm thanh (.mp3, .aac, .m4a...)
                    </label>
                  </div>
                </div>

                {/* Toggle: Gửi thông báo trong nhóm */}
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2.5">
                  <div>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Gửi tin nhắn thông báo vào nhóm sau khi lưu
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Mặc định tắt để tránh làm loãng hoặc spam cuộc trò chuyện trong nhóm.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      checked={form.mediaBackup.notifyInThread ?? false}
                      className="peer sr-only"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          mediaBackup: {
                            ...form.mediaBackup,
                            notifyInThread: e.target.checked,
                          },
                        })
                      }
                      type="checkbox"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-slate-300 peer-checked:bg-blue-600 peer-focus:outline-none dark:bg-slate-700 after:absolute after:top-[2px] after:left-[2px] after:size-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
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
                      Tên Album Google Photos riêng
                    </label>
                    <input
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      onChange={(e) =>
                        setForm({
                          ...form,
                          mediaBackup: {
                            ...form.mediaBackup,
                            photosAlbum: e.target.value,
                          },
                        })
                      }
                      placeholder={`VD: [Zalo] ${threadName || threadId}`}
                      type="text"
                      value={form.mediaBackup.photosAlbum || ''}
                    />
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      Để trống để tự động tạo album theo tên nhóm
                    </p>
                  </div>

                  <div className="sm:col-span-2">
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

          {/* Feature 2: Quy tắc xác nhận (Reactions & Timeout) */}
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
          <div
            className={`${MODAL_STICKY_FOOTER} -mb-5 flex items-center justify-end gap-2 border-t border-slate-100 bg-white pt-3 pb-5 dark:border-slate-800 dark:bg-slate-900`}
          >
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
    </Modal>
  );
}

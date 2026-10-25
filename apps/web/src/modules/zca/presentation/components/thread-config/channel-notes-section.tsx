'use client';

import { CHANNEL_NOTES_LIMITS, type IChannelNote } from '@zalobot/contracts';
import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { BUTTON_TONE } from '@/shared/ui/button-styles';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { useThreadNoteMutations, useThreadNotesQuery } from '../../../api/zca-query';
import { apiErrorText, noteTextError } from '../../../model/channel-memory';

interface ChannelNotesSectionProps {
  threadId: string;
}

const INPUT_CLASS =
  'w-full rounded-[3px] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
const SMALL_BUTTON = 'rounded-[3px] border px-2.5 py-1 text-xs font-medium';

/**
 * Ghi nhớ: what the chat told the bot to always remember (persona, group conventions). Every
 * note goes into every prompt of this chat, whatever the memory switches; members add them
 * from the chat ("nhớ nhé…", confirmed on a card) and admins here. Saved at once, not with the form.
 */
export function ChannelNotesSection({ threadId }: ChannelNotesSectionProps) {
  const query = useThreadNotesQuery(threadId);
  const { create, update, remove } = useThreadNoteMutations(threadId);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [deleting, setDeleting] = useState<IChannelNote | null>(null);
  const notes = query.data ?? [];
  const full = notes.length >= CHANNEL_NOTES_LIMITS.MAX_NOTES;

  const add = () => {
    const problem = noteTextError(draft);
    if (problem) return setError(problem);
    setError(null);
    create.mutate(draft, {
      onSuccess: () => setDraft(''),
      onError: (err) => setError(apiErrorText(err, 'Chưa lưu được, thử lại.')),
    });
  };

  const saveEdit = () => {
    if (!editing) return;
    const problem = noteTextError(editing.text);
    if (problem) return setError(problem);
    setError(null);
    update.mutate(
      { noteId: editing.id, text: editing.text },
      {
        onSuccess: () => setEditing(null),
        onError: (err) => setError(apiErrorText(err, 'Chưa lưu được, thử lại.')),
      },
    );
  };

  return (
    <section className="rounded-[3px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-2.5 border-b border-slate-100 pb-3 dark:border-slate-800">
        <span aria-hidden="true" className="text-lg">
          📌
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Ghi nhớ</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Điều bot luôn nhớ trong kênh này, ví dụ &quot;Bot là con mèo đen 2 mái&quot;. Trong chat
            nói &quot;nhớ nhé…&quot; hoặc &quot;quên vụ … đi&quot; thì bot hiện thẻ để duyệt.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {query.isPending ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Đang tải…</p>
        ) : query.isError ? (
          <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
            <span>Không tải được danh sách ghi nhớ.</span>
            <Button
              className={`${SMALL_BUTTON} ${BUTTON_TONE.secondary}`}
              onClick={() => void query.refetch()}
            >
              Thử lại
            </Button>
          </div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có điều gì.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {notes.map((note, index) => (
              <li className="flex flex-col gap-2 py-2 sm:flex-row sm:items-start" key={note.id}>
                <span className="shrink-0 text-xs font-medium text-slate-400">n{index + 1}</span>
                {editing?.id === note.id ? (
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <input
                      aria-label="Sửa điều ghi nhớ"
                      className={INPUT_CLASS}
                      maxLength={CHANNEL_NOTES_LIMITS.MAX_CHARS}
                      onChange={(e) => setEditing({ id: note.id, text: e.target.value })}
                      value={editing.text}
                    />
                    <div className="flex gap-2">
                      <Button
                        className={`${SMALL_BUTTON} ${BUTTON_TONE.primary}`}
                        disabled={update.isPending}
                        onClick={saveEdit}
                      >
                        {update.isPending ? 'Đang lưu…' : 'Lưu'}
                      </Button>
                      <Button
                        className={`${SMALL_BUTTON} ${BUTTON_TONE.secondary}`}
                        onClick={() => setEditing(null)}
                      >
                        Huỷ
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm break-words text-slate-800 dark:text-slate-200">
                        {note.text}
                      </p>
                      {note.createdByName && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Dặn bởi {note.createdByName}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        className={`${SMALL_BUTTON} ${BUTTON_TONE.ghost}`}
                        onClick={() => setEditing({ id: note.id, text: note.text })}
                      >
                        Sửa
                      </Button>
                      <Button
                        className={`${SMALL_BUTTON} ${BUTTON_TONE.dangerGhost}`}
                        onClick={() => setDeleting(note)}
                      >
                        Xoá
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            aria-label="Điều bot cần nhớ"
            className={INPUT_CLASS}
            disabled={full}
            maxLength={CHANNEL_NOTES_LIMITS.MAX_CHARS}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder={full ? 'Đã đủ, xoá bớt để thêm' : 'Ví dụ: Xưng em, gọi anh chị'}
            value={draft}
          />
          <Button
            className={`shrink-0 rounded-[3px] border px-3 py-2 text-sm font-medium ${BUTTON_TONE.primary}`}
            disabled={full || create.isPending}
            onClick={add}
          >
            {create.isPending ? 'Đang thêm…' : '+ Thêm'}
          </Button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {notes.length}/{CHANNEL_NOTES_LIMITS.MAX_NOTES} điều, mỗi điều tối đa{' '}
          {CHANNEL_NOTES_LIMITS.MAX_CHARS} ký tự. Mọi điều ghi nhớ được gửi cho AI ở mỗi lượt bot
          trả lời.
        </p>
        {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      </div>

      <ConfirmDialog
        confirmLabel="Xoá"
        isPending={remove.isPending}
        message={deleting ? `Bot sẽ không còn nhớ "${deleting.text}".` : ''}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSettled: () => setDeleting(null),
            onError: (err) => setError(apiErrorText(err, 'Chưa xoá được, thử lại.')),
          });
        }}
        open={deleting !== null}
        pendingLabel="Đang xoá…"
        title="Xoá điều ghi nhớ?"
      />
    </section>
  );
}

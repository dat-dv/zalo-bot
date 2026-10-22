'use client';

import { useState, type FormEvent } from 'react';
import type { ThreadBotConfig } from '@zalobot/contracts';
import { useUpdateZcaThreadConfigMutation } from '../../../api/zca-query';
import {
  configToForm,
  formToPayload,
  memoryDraftFrom,
  resolveChatMemory,
  type ThreadKind,
} from '../../../model/thread-config-form';

const SAVED_NOTICE_MS = 3000;

export type SaveStatus = 'idle' | 'saved' | 'error';

interface ThreadIdentity {
  threadId: string;
  threadName: string;
  threadType: ThreadKind;
}

/** Local edit state of one thread's config. Mount it only once the config has loaded. */
export function useThreadConfigForm(config: ThreadBotConfig, identity: ThreadIdentity) {
  const { threadId, threadName, threadType } = identity;
  const updateMutation = useUpdateZcaThreadConfigMutation();
  const [form, setForm] = useState(() => configToForm(config, threadType));
  const [draft, setDraft] = useState(() =>
    memoryDraftFrom(configToForm(config, threadType).chatMemory),
  );
  const [status, setStatus] = useState<SaveStatus>('idle');

  const commitDraft = () => {
    const chatMemory = resolveChatMemory(form, draft);
    setForm({ ...form, chatMemory });
    setDraft(memoryDraftFrom(chatMemory));
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('idle');
    try {
      await updateMutation.mutateAsync({
        threadId,
        data: formToPayload(form, draft, threadName, threadType),
      });
      setStatus('saved');
      setTimeout(
        () => setStatus((current) => (current === 'saved' ? 'idle' : current)),
        SAVED_NOTICE_MS,
      );
    } catch {
      setStatus('error');
    }
  };

  return {
    form,
    setForm,
    draft,
    setDraft,
    commitDraft,
    save,
    status,
    isSaving: updateMutation.isPending,
  };
}

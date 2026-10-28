'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IUpdateWebhookRecipientsRequest, IWebhookRecipient } from '@zalobot/contracts';
import { getWebhookRecipients, updateWebhookRecipients } from './webhook-recipients-api';

export const webhookRecipientsQueryKeys = {
  all: ['webhook-recipients'] as const,
};

export function useWebhookRecipientsQuery(options?: { enabled?: boolean }) {
  return useQuery<IWebhookRecipient[]>({
    queryKey: webhookRecipientsQueryKeys.all,
    queryFn: ({ signal }) => getWebhookRecipients(signal),
    enabled: options?.enabled,
  });
}

export function useUpdateWebhookRecipientsMutation() {
  const queryClient = useQueryClient();
  return useMutation<IWebhookRecipient[], Error, IUpdateWebhookRecipientsRequest>({
    mutationFn: (data) => updateWebhookRecipients(data),
    onSuccess: (saved) => {
      queryClient.setQueryData(webhookRecipientsQueryKeys.all, saved);
    },
  });
}

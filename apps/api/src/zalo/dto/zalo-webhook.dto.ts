export interface ZaloSender {
  id: string;
}

export interface ZaloRecipient {
  id: string;
}

export interface ZaloMessageAttachmentPayload {
  thumbnail?: string;
  url?: string;
  id?: string;
  description?: string;
  title?: string;
}

export interface ZaloMessageAttachment {
  type: string;
  payload?: ZaloMessageAttachmentPayload;
}

export interface ZaloWebhookMessage {
  text?: string;
  msg_id?: string;
  attachments?: ZaloMessageAttachment[];
}

export interface ZaloWebhookPayload {
  app_id?: string;
  oa_id?: string;
  user_id_by_app?: string;
  event_name: string;
  sender: ZaloSender;
  recipient: ZaloRecipient;
  message?: ZaloWebhookMessage;
  timestamp: string | number;
  info?: Record<string, unknown>;
}

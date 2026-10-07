export interface ZaloChat {
  id: string | number;
  [key: string]: unknown;
}

export interface ZaloFrom {
  id: string | number;
  display_name?: string;
  [key: string]: unknown;
}

export interface ZaloSender {
  id: string | number;
  [key: string]: unknown;
}

export interface ZaloRecipient {
  id: string | number;
  [key: string]: unknown;
}

export interface ZaloMessagePayload {
  msg_id?: string | number;
  message_id?: string | number;
  text?: string;
  chat?: ZaloChat;
  from?: ZaloFrom;
  attachments?: Array<{
    type?: string;
    payload?: Record<string, unknown>;
  }>;
  [key: string]: unknown;
}

export interface ZaloWebhookPayload {
  app_id?: string;
  user_id_by_app?: string;
  event_name?: string;
  timestamp?: string | number;
  sender?: ZaloSender;
  recipient?: ZaloRecipient;
  message?: ZaloMessagePayload;
  update_id?: number | string;
  [key: string]: unknown;
}

export type AgentInputType = 'text' | 'image' | 'voice' | 'sticker' | 'event' | 'unsupported';

export interface AgentInput {
  type: AgentInputType;
  senderId: string;
  chatId: string;
  displayName: string;
  text?: string;
  imageUrl?: string;
  voiceUrl?: string;
  stickerUrl?: string;
  caption?: string;
  eventName?: string;
  isBot?: boolean;
  raw?: unknown;
}

import { Injectable } from '@nestjs/common';
import {
  ZaloWebhookPayloadDto,
  ZaloWebhookEventName,
  normalizeZaloWebhookPayload,
} from './dto/zalo-webhook.dto';
import { AgentInput, AgentInputType } from './types/agent-input.type';
import { ZALO_EVENTS } from './zalo.constants';

@Injectable()
export class ZaloMessageParser {
  public parse(payload: ZaloWebhookPayloadDto): AgentInput {
    const normalized = normalizeZaloWebhookPayload(payload);
    const eventName = String(normalized.eventName || '');

    let type: AgentInputType = 'unsupported';

    const isSystemEvent =
      eventName === String(ZALO_EVENTS.UNFOLLOW) ||
      eventName === String(ZaloWebhookEventName.UNFOLLOW) ||
      eventName === String(ZALO_EVENTS.FOLLOW) ||
      eventName === String(ZaloWebhookEventName.FOLLOW);

    if (isSystemEvent) {
      type = 'event';
    } else if (normalized.isUnsupported) {
      type = 'unsupported';
    } else if (normalized.imageUrl) {
      type = 'image';
    } else if (normalized.voiceUrl) {
      type = 'voice';
    } else if (normalized.stickerUrl) {
      type = 'sticker';
    } else if (normalized.text) {
      type = 'text';
    }

    return {
      type,
      senderId: normalized.senderId,
      chatId: normalized.chatId,
      displayName: normalized.displayName,
      text: normalized.text,
      imageUrl: normalized.imageUrl,
      voiceUrl: normalized.voiceUrl,
      stickerUrl: normalized.stickerUrl,
      caption: normalized.caption,
      eventName: normalized.eventName,
      isBot: normalized.isBot,
      raw: payload,
    };
  }
}

export const ZALO_EVENTS = {
  USER_SEND_TEXT: 'user_send_text',
  USER_SEND_IMAGE: 'user_send_image',
  USER_SEND_LINK: 'user_send_link',
  USER_SEND_AUDIO: 'user_send_audio',
  USER_SEND_VIDEO: 'user_send_video',
  USER_SEND_STICKER: 'user_send_sticker',
  USER_RECEIVED_MESSAGE: 'user_received_message',
  USER_SEEN_MESSAGE: 'user_seen_message',
  FOLLOW: 'follow',
  UNFOLLOW: 'unfollow',
} as const;

export const ZALO_API_URLS = {
  SEND_MESSAGE: 'https://openapi.zalo.me/v3.0/oa/message/cs',
  GET_PROFILE: 'https://openapi.zalo.me/v3.0/oa/user/detail',
} as const;

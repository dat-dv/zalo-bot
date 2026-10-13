/**
 * ZCA Models Shape definitions
 * Reference: https://zca-js.tdung.com/vi/models/
 * Covers all models listed under MODELS in zca-js documentation:
 * - Attachment, AutoReply, Bank, Board, Catalog, DeliveredMessage, Enum,
 *   FriendEvent, Group, GroupEvent, Label, Message, ProductCatalog, QuickMessage,
 *   Reaction, Reminder, SeenMessage, Sticker, Typing, Undo, User, ZBusiness.
 */

export type {
  // Attachment
  AttachmentSource,

  // AutoReply
  AutoReplyItem,

  // Bank
  BankInfo,
  BankAccount,

  // Board
  PollDetail,
  PollOptions,
  NoteDetail,
  PinnedMessageDetail,

  // Catalog
  CatalogItem,

  // DeliveredMessage
  DeliveredMessage,
  TDeliveredMessage,
  TGroupDeliveredMessage,

  // FriendEvent
  FriendEvent,
  TFriendEvent,
  TFriendEventBase,
  TFriendEventRequest,
  TFriendEventRejectUndo,
  TFriendEventSeenRequest,
  TFriendEventPinCreateTopicParams,
  TFriendEventPinTopic,
  TFriendEventPinCreateTopic,
  TFriendEventPinCreate,
  TFriendEventPinUnpin,

  // Group
  GroupInfo,
  GroupCurrentMem,
  GroupSetting,
  GroupTopic,
  GroupTopicMessageParams,
  GroupTopicTextMessageParams,
  GroupTopicVoiceMessageParams,
  GroupTopicImageMessageParams,
  GroupTopicVideoMessageParams,
  GroupTopicFileMessageParams,
  GroupTopicGifMessageParams,
  GroupTopicNoteParams,
  GroupTopicPollParams,
  GroupTopicOtherParams,

  // GroupEvent
  GroupEvent,
  TGroupEvent,
  TGroupEventBase,
  TGroupEventJoinRequest,
  TGroupEventPinTopic,
  TGroupEventReorderPinTopic,
  TGroupEventBoard,
  TGroupEventRemindRespond,
  TGroupEventRemindTopic,
  GroupEventUpdateMember,
  GroupEventGroupInfo,
  GroupEventExtraData,

  // Label
  LabelData,

  // Message
  Message,
  TMessage,
  TGroupMessage,
  TAttachmentContent,
  TOtherContent,
  TQuote,
  TMention,

  // ProductCatalog
  ProductCatalogItem,

  // QuickMessage
  QuickMessage,

  // Reaction
  TReaction,

  // Reminder
  ReminderUser,
  ReminderGroup,

  // SeenMessage
  SeenMessage,
  TUserSeenMessage,
  TGroupSeenMessage,

  // Sticker
  StickerDetail,
  StickerBasic,

  // Typing
  Typing,
  TTyping,
  TGroupTyping,

  // Undo
  TUndo,
  TUndoContent,

  // User
  User,
  UserBasic,
  UserSetting,
  UnchangedProfileInfo,

  // ZBusiness
  ZBusinessPackage,
} from 'zca-js';

// Export runtime classes/constructors as values (they also serve as types in TypeScript)
export {
  UserMessage,
  GroupMessage,
  Reaction,
  Undo,
  UserDeliveredMessage,
  GroupDeliveredMessage,
  UserSeenMessage,
  GroupSeenMessage,
  UserTyping,
  GroupTyping,
  initializeFriendEvent,
  initializeGroupEvent,
} from 'zca-js';

/**
 * Normalized group member information for clean application consumption.
 */
export interface NormalizedGroupMember {
  id: string;
  dName: string;
  avatar?: string;
}

/**
 * Sending text to a Zalo chat through whichever messenger a service received: `ZcaService`
 * (`sendMessageToChat(chatId, text)`) or `ZaloService` and test doubles (`sendMessage(chatId,
 * text)`). Note `ZcaService.sendMessage` takes `(text, threadId)`, which is why the ZCA path always
 * goes through `sendMessageToChat`.
 */
export interface ChatMessenger {
  sendMessageToChat?(chatId: string | number, text: string): Promise<unknown>;
  /** Only ever called as `sendMessage(chatId, text)`. */
  sendMessage?(...args: never[]): Promise<unknown>;
  /** Called as `(chatId, text)`; resolves `{ success, msgId?, cliMsgId? }`. */
  sendMessageWithResult?(...args: never[]): Promise<unknown>;
  /** Called as `(chatId, msgId, cliMsgId?)`; resolves `true` when recalled. */
  undoMessage?(...args: never[]): Promise<unknown>;
}

export interface ChatSendResult {
  success: boolean;
  msgId?: string;
  cliMsgId?: string;
}

type AnyMethod = (...args: unknown[]) => unknown;

function getMethod(target: unknown, name: string): AnyMethod | undefined {
  if (!target || typeof target !== 'object') return undefined;
  const value: unknown = Reflect.get(target, name);
  return typeof value === 'function' ? (value as AnyMethod).bind(target) : undefined;
}

function readOptionalId(value: unknown): string | undefined {
  if (typeof value === 'string' && value) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function toSendResult(value: unknown): ChatSendResult {
  if (!value || typeof value !== 'object') return { success: Boolean(value) };
  const record = value as Record<string, unknown>;
  return {
    success: record.success === true,
    msgId: readOptionalId(record.msgId),
    cliMsgId: readOptionalId(record.cliMsgId),
  };
}

/** Posts `text`; resolves `false` when the messenger cannot send. */
export async function sendChatText(
  messenger: ChatMessenger | undefined,
  chatId: string | number,
  text: string,
): Promise<unknown> {
  const toChat = getMethod(messenger, 'sendMessageToChat');
  if (toChat) return await toChat(chatId, text);
  const send = getMethod(messenger, 'sendMessage');
  if (send) return await send(chatId, text);
  return false;
}

/** Posts `text` and returns the sent message ids when the messenger reports them. */
export async function sendChatTextWithResult(
  messenger: ChatMessenger | undefined,
  chatId: string | number,
  text: string,
): Promise<ChatSendResult> {
  const withResult = getMethod(messenger, 'sendMessageWithResult');
  if (withResult) return toSendResult(await withResult(chatId, text));
  const send = getMethod(messenger, 'sendMessage');
  if (!send) return { success: false };
  await send(chatId, text);
  return { success: true };
}

/** Recalls a message for everyone; `false` when the messenger cannot recall. */
export async function undoChatMessage(
  messenger: ChatMessenger | undefined,
  chatId: string | number,
  msgId: string,
  cliMsgId?: string,
): Promise<boolean> {
  const undo = getMethod(messenger, 'undoMessage');
  if (!undo) return false;
  return (await undo(chatId, msgId, cliMsgId)) === true;
}

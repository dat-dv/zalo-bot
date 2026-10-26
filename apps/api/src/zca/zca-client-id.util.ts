/**
 * Zalo recalls a message only with its `cliMsgId`, the `clientId` zca-js makes with `Date.now()`
 * while building a text message. zca-js returns only the `msgId`, so the clientId is caught here:
 * `Date.now` is wrapped only while `send()` runs synchronously, and its first value is kept.
 * In zca-js 2.2.0 a text message (no attachments) reads the clock first for that clientId, before
 * any await. Nothing else can run in between, so other callers of `Date.now` are not affected.
 */
export function captureClientId<T>(send: () => Promise<T>): {
  result: Promise<T>;
  clientId?: string;
} {
  const realNow = Date.now;
  let first: number | undefined;
  Date.now = () => {
    const value = realNow();
    if (first === undefined) first = value;
    return value;
  };
  let result: Promise<T>;
  try {
    result = send();
  } finally {
    Date.now = realNow;
  }
  return { result, clientId: first === undefined ? undefined : String(first) };
}

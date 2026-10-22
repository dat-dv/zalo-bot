/**
 * App-scoped user id of the removed official Zalo Bot webhook: 20 hex chars, e.g.
 * `573462d8909179cf2080`. Such ids only remain in old data; ZCA cannot message them. ZCA uids
 * are all digits, so an id needs at least one letter to count as legacy.
 */
const LEGACY_ZALO_BOT_ID = /^(?=.*[a-f])[0-9a-f]{20}$/i;

export function isLegacyZaloBotId(id: string): boolean {
  return LEGACY_ZALO_BOT_ID.test(id);
}

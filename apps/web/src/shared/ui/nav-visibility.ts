/** Admin-only items link to pages whose API rejects non-admins (`requireDashboardAdmin`). */
export interface AdminGatedItem {
  adminOnly?: boolean;
}

export interface GatedSection<TItem extends AdminGatedItem> {
  items: readonly TItem[];
}

/**
 * Hides admin-only items unless the session is known to be an admin (`undefined` while loading or
 * on error). Hiding is cosmetic: the API still enforces admin rights. Empty sections are dropped.
 */
export function visibleNavSections<TItem extends AdminGatedItem, TSection extends GatedSection<TItem>>(
  sections: readonly TSection[],
  isAdmin: boolean | undefined,
): TSection[] {
  if (isAdmin === true) return [...sections];
  return sections
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.adminOnly) }))
    .filter((section) => section.items.length > 0);
}

/**
 * Category names for the spending legend while amounts are hidden. The API ranks categories by
 * amount, so keeping that order would still say which ones cost the most.
 */
export function maskedLegendLabels(labels: readonly string[], localeTag: string): string[] {
  return [...labels].sort((a, b) => a.localeCompare(b, localeTag));
}

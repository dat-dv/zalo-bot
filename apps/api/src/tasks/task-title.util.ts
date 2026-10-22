/** Lowercase, accent-free, single-spaced title used to spot duplicate tasks. */
export function normalizeTaskTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .toLocaleLowerCase('vi-VN')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Same normalized title, or the shorter one (2+ words) contained in the longer one. */
export function arePotentialDuplicateTaskTitles(left: string, right: string): boolean {
  const normalizedLeft = normalizeTaskTitle(left);
  const normalizedRight = normalizeTaskTitle(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const shorter =
    normalizedLeft.length <= normalizedRight.length ? normalizedLeft : normalizedRight;
  const longer = normalizedLeft.length <= normalizedRight.length ? normalizedRight : normalizedLeft;
  return shorter.split(' ').length >= 2 && longer.includes(shorter);
}

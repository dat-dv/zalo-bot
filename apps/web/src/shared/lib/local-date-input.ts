const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DDTHH:mm` in the browser's time zone, the value format of `<input type="datetime-local">`. */
export function toLocalDateTimeInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/**
 * A `<input type="date">` value as a due date: end of that day in UTC, the convention the
 * debt and task inline edits already store. Empty input → `undefined`.
 */
export function dueDateToIso(date: string): string | undefined {
  return date ? new Date(`${date}T23:59:59.000Z`).toISOString() : undefined;
}

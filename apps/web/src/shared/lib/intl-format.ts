import { localeTag, type SupportedLocale } from '@zalobot/contracts';

// Formatters are kept per locale and options: building an `Intl.DateTimeFormat` costs far more
// than formatting with it, and the table screens format a date for every row on every render.
const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();

/** A shared `Intl.DateTimeFormat` for the dashboard locale and `options`. */
export function getDateTimeFormat(
  locale: SupportedLocale,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const tag = localeTag(locale);
  const key = `${tag}|${JSON.stringify(options)}`;
  let formatter = dateTimeFormats.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(tag, options);
    dateTimeFormats.set(key, formatter);
  }
  return formatter;
}

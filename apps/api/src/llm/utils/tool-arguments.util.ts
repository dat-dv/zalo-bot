/**
 * Recursively unwraps a single tool argument value that may have been wrapped
 * in an extra object by smaller LLMs (like Qwen 7b) or Ollama.
 *
 * Examples of malformed inputs:
 * - { amount: { amount: 15000 } } -> 15000
 * - { amount: { value: 15000 } } -> 15000
 * - { category: { category: "Ăn uống" } } -> "Ăn uống"
 * - { note: { note: "uống cà phê" } } -> "uống cà phê"
 * - { type: { type: "expense" } } -> "expense"
 * - { amount: { inner: 15000 } } -> 15000
 */
export function unwrapArgumentValue(key: string, val: unknown): unknown {
  if (val === null || val === undefined) return val;

  if (typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
    const record = val as Record<string, unknown>;
    const keys = Object.keys(record);

    if (keys.length === 0) {
      return val;
    }

    // 1. Same key: { "amount": { "amount": 15000 } }
    if (key in record) {
      return unwrapArgumentValue(key, record[key]);
    }

    // 2. Common wrapper keys: { "amount": { "value": 15000 } } or { "val": 15000 }
    if ('value' in record) {
      return unwrapArgumentValue(key, record.value);
    }
    if ('val' in record) {
      return unwrapArgumentValue(key, record.val);
    }

    // 3. Single key object: { "amount": { "anything": 15000 } }
    if (keys.length === 1) {
      return unwrapArgumentValue(key, record[keys[0]]);
    }
  }

  return val;
}

/**
 * Sanitizes and flattens a dictionary of tool arguments.
 */
export function cleanToolArguments(
  args: Record<string, unknown> | undefined | null,
): Record<string, unknown> {
  if (!args || typeof args !== 'object') return {};
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(args)) {
    cleaned[key] = unwrapArgumentValue(key, value);
  }

  return cleaned;
}

/**
 * Safely parses monetary amount into a positive number.
 * Handles numbers, strings (e.g. "15k", "15tr", "15000", "15.000", "15,000"),
 * and wrapped objects like { amount: 15000 } or { value: 15000 }.
 */
export function parseAmount(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? Math.abs(raw) : 0;
  }

  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const inner = obj.amount ?? obj.value ?? obj.val ?? Object.values(obj)[0];
    return parseAmount(inner);
  }

  if (typeof raw === 'string') {
    const cleaned = raw.trim().toLowerCase().replace(/,/g, '');

    // Check Vietnamese suffixes: 15k, 15ng, 15 nghìn, 15 ngàn
    const kMatch = cleaned.match(/^([\d.]+)\s*(k|ng|nghìn|ngàn)$/);
    if (kMatch) {
      const val = parseFloat(kMatch[1]);
      return Number.isFinite(val) ? Math.abs(Math.round(val * 1000)) : 0;
    }

    // Check Vietnamese suffixes: 15tr, 15 triệu, 15m
    const trMatch = cleaned.match(/^([\d.]+)\s*(tr|triệu|m)$/);
    if (trMatch) {
      const val = parseFloat(trMatch[1]);
      return Number.isFinite(val) ? Math.abs(Math.round(val * 1000000)) : 0;
    }

    const num = parseFloat(cleaned);
    if (Number.isFinite(num)) {
      return Math.abs(Math.round(num));
    }
  }

  return 0;
}

/**
 * Normalizes tool parameter schema types to standard lowercase JSON Schema (string, number, object, etc.)
 */
export function normalizeSchemaTypes(schema: unknown): unknown {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(normalizeSchemaTypes);

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(schema as Record<string, unknown>)) {
    if (key === 'type' && typeof val === 'string') {
      result[key] = val.toLowerCase();
    } else {
      result[key] = normalizeSchemaTypes(val);
    }
  }
  return result;
}

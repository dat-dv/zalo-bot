/**
 * SQL builders for chat-memory search. Every query is scoped to one channel: a question asked in
 * one Zalo thread never reads another thread's messages.
 */

export interface ChatMemorySearchParams {
  /** Comma/semicolon/newline separated keywords and synonyms, as produced by the LLM. */
  keywords: string;
  /** Inclusive `YYYY-MM-DD` in `timeZone`. */
  fromDate?: string;
  /** Inclusive `YYYY-MM-DD` in `timeZone`. */
  toDate?: string;
  limit: number;
  timeZone: string;
  /** The message asking the question: it always matches its own keywords, so it is skipped. */
  excludeMsgId?: string;
}

export interface SqlQuery {
  sql: string;
  params: unknown[];
}

export const MAX_SEARCH_KEYWORDS = 12;
/** Messages shown before / from each hit (the hit itself is part of the "after" side). */
export const NEIGHBOURS_BEFORE = 3;
export const NEIGHBOURS_AFTER = 4;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseKeywords(raw: string): string[] {
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const part of (raw || '').split(/[,;\n]+/)) {
    const keyword = part.trim();
    const key = keyword.toLowerCase();
    if (keyword.length < 2 || seen.has(key)) continue;
    seen.add(key);
    keywords.push(keyword);
    if (keywords.length >= MAX_SEARCH_KEYWORDS) break;
  }
  return keywords;
}

export function normalizeDate(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !DATE_PATTERN.test(trimmed)) return undefined;
  return Number.isNaN(Date.parse(`${trimmed}T00:00:00Z`)) ? undefined : trimmed;
}

/** Ranked ids of matching messages; `null` when there is no usable keyword. */
export function buildHitQuery(channelId: string, search: ChatMemorySearchParams): SqlQuery | null {
  const keywords = parseKeywords(search.keywords);
  if (keywords.length === 0) return null;

  const params: unknown[] = [channelId];
  const tsQueries = keywords.map((keyword) => {
    params.push(keyword);
    return `plainto_tsquery('simple', zalobot_unaccent($${params.length}))`;
  });

  // Bot replies never count as hits (an earlier, maybe wrong answer is not evidence); they can
  // still appear as neighbours of a real hit.
  const conditions = [
    'm.channel_id = $1',
    'm.recalled_at IS NULL',
    'NOT m.is_bot',
    'm.search_vector @@ q.query',
  ];
  if (search.excludeMsgId) {
    params.push(search.excludeMsgId);
    conditions.push(`m.msg_id <> $${params.length}`);
  }
  const fromDate = normalizeDate(search.fromDate);
  const toDate = normalizeDate(search.toDate);
  if (fromDate || toDate) {
    params.push(search.timeZone);
    const tzParam = `$${params.length}`;
    if (fromDate) {
      params.push(fromDate);
      conditions.push(`m.sent_at >= ($${params.length}::date)::timestamp AT TIME ZONE ${tzParam}`);
    }
    if (toDate) {
      params.push(toDate);
      conditions.push(
        `m.sent_at < (($${params.length}::date) + 1)::timestamp AT TIME ZONE ${tzParam}`,
      );
    }
  }

  params.push(search.limit);
  const sql =
    `WITH q AS (SELECT (${tsQueries.join(' || ')}) AS query) ` +
    `SELECT m.id FROM zca_messages m, q ` +
    `WHERE ${conditions.join(' AND ')} ` +
    `ORDER BY ts_rank(m.search_vector, q.query) DESC, m.sent_at DESC ` +
    `LIMIT $${params.length}`;
  return { sql, params };
}

/** Each hit with its surrounding messages, tagged with the hit's rank (`hit_rank`, 1 = best). */
export function buildNeighbourQuery(channelId: string, hitIds: readonly string[]): SqlQuery {
  const columns = 'id, sender_name, is_bot, text, sent_at';
  const sql =
    `SELECT w.id, w.sender_name, w.is_bot, w.text, w.sent_at, h.hit_rank ` +
    `FROM unnest($2::uuid[]) WITH ORDINALITY AS h(hit_id, hit_rank) ` +
    `JOIN zca_messages hit ON hit.id = h.hit_id AND hit.channel_id = $1 ` +
    `CROSS JOIN LATERAL (` +
    `(SELECT ${columns} FROM zca_messages p WHERE p.channel_id = $1 AND p.recalled_at IS NULL ` +
    `AND p.text IS NOT NULL AND p.sent_at < hit.sent_at ORDER BY p.sent_at DESC LIMIT ${NEIGHBOURS_BEFORE}) ` +
    `UNION ALL ` +
    `(SELECT ${columns} FROM zca_messages n WHERE n.channel_id = $1 AND n.recalled_at IS NULL ` +
    `AND n.text IS NOT NULL AND n.sent_at >= hit.sent_at ORDER BY n.sent_at ASC LIMIT ${NEIGHBOURS_AFTER})` +
    `) w ` +
    `ORDER BY h.hit_rank ASC, w.sent_at ASC`;
  return { sql, params: [channelId, [...hitIds]] };
}

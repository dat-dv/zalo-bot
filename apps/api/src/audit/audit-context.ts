import { AsyncLocalStorage } from 'node:async_hooks';
import type { AuditActorSource } from '@zalobot/contracts';

/** Who is causing the database writes of the current request, Zalo event or job. */
export interface AuditContextStore {
  source: AuditActorSource;
  /** `users.id`; unset until known (dashboard: after the token is verified). */
  actorId?: string;
  /** Zalo chat the change came from. */
  channelId?: string;
}

// A plain module-level store (not a Nest provider) so the dashboard auth helpers and the
// TypeORM subscriber can reach it without module imports.
const storage = new AsyncLocalStorage<AuditContextStore>();

export const AuditContext = {
  /** Runs `fn` with its own store; async work started inside inherits it. */
  run<T>(store: AuditContextStore, fn: () => T): T {
    return storage.run({ ...store }, fn);
  },

  /**
   * Background work (jobs, imports) that must not be credited to the request or chat
   * that happened to start it.
   */
  runAsSystem<T>(fn: () => T): T {
    return storage.run({ source: 'system' }, fn);
  },

  current(): AuditContextStore | undefined {
    return storage.getStore();
  },

  /** Records the verified actor of the current store; no-op outside one. */
  setActor(actorId: string): void {
    const store = storage.getStore();
    if (store) store.actorId = actorId;
  },
};

/** Context of a Zalo event; zca-js hands ids over as strings or numbers. */
export function zaloAuditContext(senderId: unknown, channelId: unknown): AuditContextStore {
  return { source: 'zalo', actorId: toAuditId(senderId), channelId: toAuditId(channelId) };
}

function toAuditId(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

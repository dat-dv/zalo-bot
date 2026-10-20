import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { AuditLogEntity } from './entities/audit-log.entity';

@EventSubscriber()
export class AuditLogSubscriber implements EntitySubscriberInterface {
  private readonly ignoredTables = new Set(['audit_logs']);

  public async afterInsert(event: InsertEvent<unknown>): Promise<void> {
    await this.write(event, 'insert', undefined, event.entity as Record<string, unknown>);
  }

  public async afterUpdate(event: UpdateEvent<unknown>): Promise<void> {
    await this.write(
      event,
      'update',
      event.databaseEntity as Record<string, unknown> | undefined,
      event.entity,
    );
  }

  public async afterRemove(event: RemoveEvent<unknown>): Promise<void> {
    await this.write(event, 'remove', event.databaseEntity as Record<string, unknown>, undefined);
  }

  private async write(
    event: InsertEvent<unknown> | UpdateEvent<unknown> | RemoveEvent<unknown>,
    action: AuditLogEntity['action'],
    beforeData?: Record<string, unknown>,
    afterData?: Record<string, unknown>,
  ): Promise<void> {
    const tableName = event.metadata.tableName;
    if (this.ignoredTables.has(tableName)) return;
    const data = afterData || beforeData || {};
    const recordId = event.metadata.primaryColumns
      .map((column) => {
        const value = data[column.propertyName];
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'bigint') return value.toString();
        return '';
      })
      .filter(Boolean)
      .join(':');
    await event.manager.getRepository(AuditLogEntity).save({
      tableName,
      recordId: recordId || undefined,
      action,
      // Finance rows are shared (no owner), so their author is the actor.
      actorId:
        typeof data.userId === 'string'
          ? data.userId
          : typeof data.createdByUserId === 'string'
            ? data.createdByUserId
            : undefined,
      beforeData: this.redact(beforeData),
      afterData: this.redact(afterData),
    });
  }

  private redact(data?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!data) return undefined;
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        /token|secret|password|authorization/i.test(key) ? '[REDACTED]' : value,
      ]),
    );
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IUserLinkedContactItem } from '@zalobot/contracts';
import { DebtContactEntity } from '../database/entities/debt-contact.entity';
import { DebtEntity } from '../database/entities/debt.entity';

interface CountRow {
  key: string;
  count: string | number;
}

/**
 * Chiều ngược của liên kết Người liên quan → User: cho trang ZCA (admin) biết
 * một tài khoản đang được gắn với Người liên quan nào trong danh bạ công nợ chung.
 */
@Injectable()
export class UserLinkedContactsService {
  constructor(
    @InjectRepository(DebtContactEntity)
    private readonly contactRepo: Repository<DebtContactEntity>,
    @InjectRepository(DebtEntity)
    private readonly debtRepo: Repository<DebtEntity>,
  ) {}

  /** Một truy vấn GROUP BY cho cả bảng user, tránh N+1 trên danh sách. */
  public async countByLinkedUser(): Promise<Map<string, number>> {
    const rows = await this.contactRepo
      .createQueryBuilder('contact')
      .select('contact.linked_user_id', 'key')
      .addSelect('COUNT(*)', 'count')
      .where('contact.linked_user_id IS NOT NULL')
      .groupBy('contact.linked_user_id')
      .getRawMany<CountRow>();
    return toCountMap(rows);
  }

  public async listForUser(linkedUserId: string): Promise<IUserLinkedContactItem[]> {
    const contacts = await this.contactRepo.find({
      where: { linkedUserId },
      order: { createdAt: 'ASC' },
    });
    if (contacts.length === 0) return [];

    const debtRows = await this.debtRepo
      .createQueryBuilder('debt')
      .select('debt.contact_id', 'key')
      .addSelect('COUNT(*)', 'count')
      .where('debt.contact_id IN (:...ids)', { ids: contacts.map((c) => c.id) })
      .groupBy('debt.contact_id')
      .getRawMany<CountRow>();

    return toLinkedContactItems(contacts, toCountMap(debtRows));
  }
}

export function toCountMap(rows: CountRow[]): Map<string, number> {
  return new Map(rows.map((row) => [row.key, Number(row.count) || 0]));
}

export function toLinkedContactItems(
  contacts: DebtContactEntity[],
  debtCounts: Map<string, number>,
): IUserLinkedContactItem[] {
  return contacts.map((contact) => ({
    contactId: contact.id,
    displayName: contact.displayName,
    alias: contact.alias || undefined,
    debtCount: debtCounts.get(contact.id) ?? 0,
    createdAt: new Date(contact.createdAt).toISOString(),
  }));
}

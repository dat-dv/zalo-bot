import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, type Repository, type SelectQueryBuilder } from 'typeorm';
import { DebtEntity } from '../database/entities/debt.entity';
import { FinanceTransactionEntity } from '../database/entities/finance-transaction.entity';

const TOP_CATEGORIES = 5;
const TOP_TRANSACTIONS = 3;

export interface FinanceBreakdownFilter {
  /** Inclusive; empty means no lower bound. */
  startAt?: Date | null;
  /** Exclusive; empty means no upper bound. */
  endAt?: Date | null;
  type?: 'income' | 'expense';
  category?: string;
  placeIds?: readonly string[];
  contactIds?: readonly string[];
  keyword?: string;
}

export interface FinanceBreakdown {
  income: number;
  expense: number;
  count: number;
  /** Biggest spending categories, or income ones when the filter asks only for income. */
  topCategories: Array<{ category: string; amount: number }>;
  topTransactions: Array<{ note: string; amount: number; occurredAt: Date }>;
}

/** `%` and `_` in a user's keyword mean themselves. */
function likePattern(keyword: string): string {
  return `%${keyword.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/**
 * Period and filter totals, computed in SQL. Separate from FinanceService because it only reads
 * and both the chat report and the scheduled digest need exactly the same numbers.
 */
@Injectable()
export class FinanceReportService {
  constructor(
    @InjectRepository(FinanceTransactionEntity)
    private readonly transactionRepo: Repository<FinanceTransactionEntity>,
    @InjectRepository(DebtEntity)
    private readonly debtRepo: Repository<DebtEntity>,
  ) {}

  /**
   * Every debt for export, unlike the capped screen list. Merged debts are left out because their
   * parent already carries the amount; listing both would count it twice.
   */
  public listAllRootDebts(): Promise<DebtEntity[]> {
    return this.debtRepo.find({
      where: { parentDebtId: IsNull() },
      order: { occurredAt: 'DESC', createdAt: 'DESC', id: 'DESC' },
    });
  }

  private filtered(filter: FinanceBreakdownFilter): SelectQueryBuilder<FinanceTransactionEntity> {
    const query = this.transactionRepo.createQueryBuilder('t');
    if (filter.startAt) query.andWhere('t.occurredAt >= :startAt', { startAt: filter.startAt });
    if (filter.endAt) query.andWhere('t.occurredAt < :endAt', { endAt: filter.endAt });
    if (filter.type) query.andWhere('t.type = :type', { type: filter.type });
    if (filter.category) {
      query.andWhere('LOWER(t.category) = LOWER(:category)', { category: filter.category.trim() });
    }
    if (filter.placeIds?.length) {
      query.andWhere('t.placeId IN (:...placeIds)', { placeIds: filter.placeIds });
    }
    if (filter.contactIds?.length) {
      query.andWhere('t.contactId IN (:...contactIds)', { contactIds: filter.contactIds });
    }
    if (filter.keyword?.trim()) {
      query.andWhere('t.note ILIKE :keyword', { keyword: likePattern(filter.keyword.trim()) });
    }
    return query;
  }

  public async getBreakdown(filter: FinanceBreakdownFilter): Promise<FinanceBreakdown> {
    const categoryType = filter.type ?? 'expense';
    const [totals, categories, transactions] = await Promise.all([
      this.filtered(filter)
        .select('t.type', 'type')
        .addSelect('COALESCE(SUM(t.amount), 0)', 'amount')
        .addSelect('COUNT(*)', 'count')
        .groupBy('t.type')
        .getRawMany<{ type: string; amount: string; count: string }>(),
      this.filtered(filter)
        .andWhere('t.type = :categoryType', { categoryType })
        .select('t.category', 'category')
        .addSelect('SUM(t.amount)', 'amount')
        .groupBy('t.category')
        .orderBy('SUM(t.amount)', 'DESC')
        .limit(TOP_CATEGORIES)
        .getRawMany<{ category: string; amount: string }>(),
      this.filtered(filter)
        .andWhere('t.type = :categoryType', { categoryType })
        .orderBy('t.amount', 'DESC')
        .addOrderBy('t.occurredAt', 'DESC')
        .take(TOP_TRANSACTIONS)
        .getMany(),
    ]);

    const total = (type: string) => totals.find((row) => row.type === type);
    return {
      income: Number(total('income')?.amount ?? 0),
      expense: Number(total('expense')?.amount ?? 0),
      count: totals.reduce((sum, row) => sum + Number(row.count), 0),
      topCategories: categories.map((row) => ({
        category: row.category,
        amount: Number(row.amount),
      })),
      topTransactions: transactions.map(({ note, amount, occurredAt }) => ({
        note,
        amount,
        occurredAt,
      })),
    };
  }
}

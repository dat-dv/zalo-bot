import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import {
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  type ICreateCategoryRequest,
  type IUpdateCategoryRequest,
  type AnalyticsGrain,
  type IFinanceAnalyticsResponse,
  type IAnalyticsTrendBucket,
  type IAnalyticsCategoryBreakdown,
  type ICandidateDebtItem,
  type IDebtAllocationItem,
} from '@zalobot/contracts';
import { FinanceTransactionEntity } from '../database/entities/finance-transaction.entity';
import { DebtEntity } from '../database/entities/debt.entity';
import { DebtContactEntity } from '../database/entities/debt-contact.entity';
import { DebtPaymentEntity } from '../database/entities/debt-payment.entity';
import { DebtPaymentAllocationEntity } from '../database/entities/debt-payment-allocation.entity';
import { UserCategoryEntity } from '../database/entities/user-category.entity';
import { FinancePlaceEntity } from '../database/entities/finance-place.entity';

export interface CreateFinanceTransactionDto {
  userId: number;
  type: 'income' | 'expense';
  amount: number;
  currency?: string;
  category?: string;
  paymentMethod?: string;
  receiptUrl?: string;
  contactId?: string;
  placeId?: string | null;
  createNewPlace?: boolean;
  placeName?: string;
  note: string;
  occurredAt?: string;
}

export interface FinanceSummary {
  income: number;
  expense: number;
  balance: number;
  transactions: FinanceTransactionEntity[];
}

export interface CreateDebtDto {
  userId: number;
  direction: 'receivable' | 'payable';
  counterparty: string;
  counterpartyAlias?: string;
  contactId?: string;
  createNewContact?: boolean;
  amount: number;
  currency?: string;
  note?: string;
  occurredAt?: string;
  dueAt?: string;
}

export interface UpdateTransactionDto {
  type?: 'income' | 'expense';
  amount?: number;
  currency?: string;
  category?: string;
  paymentMethod?: string;
  receiptUrl?: string;
  contactId?: string;
  placeId?: string | null;
  createNewPlace?: boolean;
  placeName?: string;
  note?: string;
  occurredAt?: string;
}

export interface UpdateDebtDto {
  direction?: 'receivable' | 'payable';
  counterparty?: string;
  counterpartyAlias?: string;
  contactId?: string;
  originalAmount?: number;
  remainingAmount?: number;
  amount?: number;
  currency?: string;
  note?: string;
  occurredAt?: string;
  dueAt?: string;
}

export interface CombineContactsDto {
  targetContactId: string;
  sourceContactIds: string[];
  displayName?: string;
  alias?: string;
  descriptor?: string;
  consolidateDebts?: boolean;
}

export interface CombineContactsResult {
  targetContact: DebtContactEntity;
  affectedDebtsCount: number;
  mergedCount: number;
}

export interface CombineDebtsDto {
  debtIds: string[];
  counterparty?: string;
  counterpartyAlias?: string;
  contactId?: string;
  note?: string;
  dueAt?: string;
}

export interface CombineDebtsResult {
  parentDebt: DebtEntity;
  mergedDebtsCount: number;
}

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(FinanceTransactionEntity)
    private readonly transactionRepo: Repository<FinanceTransactionEntity>,
    @InjectRepository(DebtEntity)
    private readonly debtRepo: Repository<DebtEntity>,
    @InjectRepository(DebtContactEntity)
    private readonly contactRepo: Repository<DebtContactEntity>,
    @InjectRepository(DebtPaymentEntity)
    private readonly debtPaymentRepo: Repository<DebtPaymentEntity>,
    @InjectRepository(DebtPaymentAllocationEntity)
    private readonly allocationRepo: Repository<DebtPaymentAllocationEntity>,
    @InjectRepository(UserCategoryEntity)
    private readonly userCategoryRepo: Repository<UserCategoryEntity>,
    @InjectRepository(FinancePlaceEntity)
    private readonly placeRepo: Repository<FinancePlaceEntity>,
  ) {}

  public async resolveOrCreatePlace(
    userId: number,
    placeName: string,
  ): Promise<FinancePlaceEntity | null> {
    const trimmed = placeName?.trim();
    if (!trimmed) return null;
    const normalizedName = this.normalizeIdentity(trimmed);
    const existing = await this.placeRepo.findOne({
      where: { userId: userId.toString(), normalizedName },
    });
    if (existing) {
      return existing;
    }
    return this.placeRepo.save(
      this.placeRepo.create({
        userId: userId.toString(),
        name: trimmed,
        normalizedName,
      }),
    );
  }

  public async createTransaction(
    dto: CreateFinanceTransactionDto,
  ): Promise<FinanceTransactionEntity> {
    const amount = Math.round(Number(dto.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Số tiền phải lớn hơn 0.');
    }

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      throw new Error('Ngày phát sinh không hợp lệ.');
    }

    const note = dto.note?.trim();
    if (!note) {
      throw new Error('Cần có nội dung cho khoản thu hoặc chi.');
    }

    const placeId = await this.resolvePlaceId(dto.userId, dto.placeId, dto.placeName);

    const transaction = this.transactionRepo.create({
      userId: dto.userId.toString(),
      type: dto.type,
      amount,
      currency: dto.currency?.trim() || 'VND',
      category: dto.category?.trim() || 'Khác',
      paymentMethod: dto.paymentMethod?.trim() || undefined,
      receiptUrl: dto.receiptUrl?.trim() || undefined,
      contactId: dto.contactId || undefined,
      placeId,
      note,
      occurredAt,
    });
    return this.transactionRepo.save(transaction);
  }

  public async getSummary(
    userId: number,
    startAt?: string,
    endAt?: string,
  ): Promise<FinanceSummary> {
    const where: FindOptionsWhere<FinanceTransactionEntity> = {
      userId: userId.toString(),
    };

    if (startAt && endAt) {
      const startDate = new Date(startAt);
      const endDate = new Date(endAt);
      if (Number.isNaN(startDate.getTime())) throw new Error('Mốc thời gian bắt đầu không hợp lệ.');
      if (Number.isNaN(endDate.getTime())) throw new Error('Mốc thời gian kết thúc không hợp lệ.');
      where.occurredAt = Between(startDate, endDate);
    } else if (startAt) {
      const startDate = new Date(startAt);
      if (Number.isNaN(startDate.getTime())) throw new Error('Mốc thời gian bắt đầu không hợp lệ.');
      where.occurredAt = MoreThanOrEqual(startDate);
    } else if (endAt) {
      const endDate = new Date(endAt);
      if (Number.isNaN(endDate.getTime())) throw new Error('Mốc thời gian kết thúc không hợp lệ.');
      where.occurredAt = LessThanOrEqual(endDate);
    }

    const transactions = await this.transactionRepo.find({
      where,
      relations: { place: true, allocations: { debt: true } },
      order: { occurredAt: 'DESC' },
    });
    const income = transactions
      .filter((transaction) => transaction.type === 'income')
      .reduce((total, transaction) => total + transaction.amount, 0);
    const expense = transactions
      .filter((transaction) => transaction.type === 'expense')
      .reduce((total, transaction) => total + transaction.amount, 0);

    return { income, expense, balance: income - expense, transactions };
  }

  public async getAnalyticsReport(
    userId: number,
    startAt?: string,
    endAt?: string,
    grain: AnalyticsGrain = 'month',
  ): Promise<IFinanceAnalyticsResponse> {
    const summary = await this.getSummary(userId, startAt, endAt);
    const allTimeSummary = startAt || endAt ? await this.getSummary(userId) : summary;
    const debts = await this.getActiveDebts(userId);

    const receivableTotal = debts
      .filter((d) => d.direction === 'receivable')
      .reduce((sum, d) => sum + d.remainingAmount, 0);

    const payableTotal = debts
      .filter((d) => d.direction === 'payable')
      .reduce((sum, d) => sum + d.remainingAmount, 0);

    const netSavingsRate =
      summary.income > 0
        ? Math.max(0, ((summary.income - summary.expense) / summary.income) * 100)
        : 0;

    let openingBalance = 0;
    if (startAt) {
      const startDate = new Date(startAt);
      if (!Number.isNaN(startDate.getTime())) {
        const priorTransactions = await this.transactionRepo.find({
          where: {
            userId: userId.toString(),
            occurredAt: LessThan(startDate),
          },
        });
        const priorIncome = priorTransactions
          .filter((tx) => tx.type === 'income')
          .reduce((sum, tx) => sum + tx.amount, 0);
        const priorExpense = priorTransactions
          .filter((tx) => tx.type === 'expense')
          .reduce((sum, tx) => sum + tx.amount, 0);
        openingBalance = priorIncome - priorExpense;
      }
    }

    const trend = this.generateTrendBuckets(
      summary.transactions,
      startAt,
      endAt,
      grain,
      openingBalance,
    );

    const categoryMap = new Map<
      string,
      { category: string; amount: number; count: number; type: 'income' | 'expense' }
    >();
    for (const tx of summary.transactions) {
      const cat = tx.category?.trim() || 'Khác';
      const key = `${tx.type}:${cat}`;
      const existing = categoryMap.get(key) || {
        category: cat,
        amount: 0,
        count: 0,
        type: tx.type,
      };
      existing.amount += tx.amount;
      existing.count += 1;
      categoryMap.set(key, existing);
    }

    const categories: IAnalyticsCategoryBreakdown[] = Array.from(categoryMap.values())
      .map((data) => {
        const totalForType = data.type === 'income' ? summary.income : summary.expense;
        const percentage = totalForType > 0 ? (data.amount / totalForType) * 100 : 0;
        return {
          category: data.category,
          type: data.type,
          amount: data.amount,
          count: data.count,
          percentage: Number(percentage.toFixed(1)),
        };
      })
      .sort((a, b) => b.amount - a.amount);

    const topReceivables = debts
      .filter((d) => d.direction === 'receivable' && d.remainingAmount > 0)
      .map((d) => ({
        contactId: d.contactId,
        counterparty: d.counterparty,
        amount: d.remainingAmount,
      }))
      .sort((a, b) => b.amount - a.amount);

    const topPayables = debts
      .filter((d) => d.direction === 'payable' && d.remainingAmount > 0)
      .map((d) => ({
        contactId: d.contactId,
        counterparty: d.counterparty,
        amount: d.remainingAmount,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      summary: {
        income: summary.income,
        expense: summary.expense,
        balance: summary.balance,
        netSavingsRate: Number(netSavingsRate.toFixed(1)),
        receivableTotal,
        payableTotal,
      },
      currentPosition: {
        cashflowBalance: allTimeSummary.balance,
        receivable: receivableTotal,
        payable: payableTotal,
        netWorth: allTimeSummary.balance + receivableTotal - payableTotal,
      },
      trend,
      categories,
      debts: {
        receivable: receivableTotal,
        payable: payableTotal,
        netDebt: receivableTotal - payableTotal,
        topReceivables,
        topPayables,
      },
    };
  }

  private generateTrendBuckets(
    transactions: FinanceTransactionEntity[],
    startAt?: string,
    endAt?: string,
    grain: AnalyticsGrain = 'month',
    openingBalance = 0,
  ): IAnalyticsTrendBucket[] {
    const startDate = startAt ? new Date(startAt) : new Date(0);
    const endDate = endAt ? new Date(endAt) : new Date();

    let buckets: IAnalyticsTrendBucket[] = [];

    if (grain === 'week') {
      const dayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
      buckets = dayLabels.map((label, idx) => ({
        key: `day-${idx}`,
        label,
        income: 0,
        expense: 0,
        netCashflow: 0,
        balance: 0,
        startAt: '',
        endAt: '',
      }));

      for (const tx of transactions) {
        const d = new Date(tx.occurredAt);
        if (Number.isNaN(d.getTime())) continue;
        const dayIdx = (d.getDay() + 6) % 7;
        if (tx.type === 'income') {
          buckets[dayIdx].income += tx.amount;
        } else {
          buckets[dayIdx].expense += tx.amount;
        }
      }
    } else if (grain === 'month') {
      const lastDay = endDate.getDate() || 30;
      const intervals = [
        { key: 'p1', label: '1-5', start: 1, end: 5 },
        { key: 'p2', label: '6-10', start: 6, end: 10 },
        { key: 'p3', label: '11-15', start: 11, end: 15 },
        { key: 'p4', label: '16-20', start: 16, end: 20 },
        { key: 'p5', label: '21-25', start: 21, end: 25 },
        { key: 'p6', label: `26-${lastDay}`, start: 26, end: lastDay },
      ];

      buckets = intervals.map((iv) => ({
        key: iv.key,
        label: iv.label,
        income: 0,
        expense: 0,
        netCashflow: 0,
        balance: 0,
        startAt: '',
        endAt: '',
      }));

      for (const tx of transactions) {
        const d = new Date(tx.occurredAt);
        if (Number.isNaN(d.getTime())) continue;
        const day = d.getDate();
        const bucketIndex = intervals.findIndex((iv) => day >= iv.start && day <= iv.end);
        if (bucketIndex >= 0) {
          if (tx.type === 'income') {
            buckets[bucketIndex].income += tx.amount;
          } else {
            buckets[bucketIndex].expense += tx.amount;
          }
        }
      }
    } else if (grain === 'quarter') {
      const month = startDate.getMonth();
      const startMonth = Math.floor(month / 3) * 3;
      buckets = [0, 1, 2].map((idx) => ({
        key: `m-${startMonth + idx}`,
        label: `Tháng ${String(startMonth + idx + 1).padStart(2, '0')}`,
        income: 0,
        expense: 0,
        netCashflow: 0,
        balance: 0,
        startAt: '',
        endAt: '',
      }));

      for (const tx of transactions) {
        const d = new Date(tx.occurredAt);
        if (Number.isNaN(d.getTime())) continue;
        const m = d.getMonth();
        const bucketIndex = m - startMonth;
        if (bucketIndex >= 0 && bucketIndex < 3) {
          if (tx.type === 'income') {
            buckets[bucketIndex].income += tx.amount;
          } else {
            buckets[bucketIndex].expense += tx.amount;
          }
        }
      }
    } else {
      // Default: 12 months for year or all
      buckets = Array.from({ length: 12 }, (_, i) => ({
        key: `m-${i}`,
        label: `T${String(i + 1).padStart(2, '0')}`,
        income: 0,
        expense: 0,
        netCashflow: 0,
        balance: 0,
        startAt: '',
        endAt: '',
      }));

      for (const tx of transactions) {
        const d = new Date(tx.occurredAt);
        if (Number.isNaN(d.getTime())) continue;
        const m = d.getMonth();
        if (m >= 0 && m < 12) {
          if (tx.type === 'income') {
            buckets[m].income += tx.amount;
          } else {
            buckets[m].expense += tx.amount;
          }
        }
      }
    }

    let runningBalance = openingBalance;
    for (const b of buckets) {
      b.netCashflow = b.income - b.expense;
      runningBalance += b.netCashflow;
      b.balance = runningBalance;
    }

    return buckets;
  }

  public async listTransactions(
    userId: number,
    type?: 'income' | 'expense',
  ): Promise<FinanceTransactionEntity[]> {
    const where: FindOptionsWhere<FinanceTransactionEntity> = {
      userId: userId.toString(),
    };
    if (type) where.type = type;
    return this.transactionRepo.find({
      where,
      relations: {
        place: true,
        contact: true,
        allocations: { debt: true },
      },
      order: { occurredAt: 'DESC' },
      take: 200,
    });
  }

  public getTransaction(userId: number, id: string): Promise<FinanceTransactionEntity | null> {
    return this.transactionRepo.findOne({
      where: { id, userId: userId.toString() },
      relations: { place: true, contact: true, allocations: { debt: true } },
    });
  }

  public getLatestTransaction(userId: number): Promise<FinanceTransactionEntity | null> {
    return this.transactionRepo.findOne({
      where: { userId: userId.toString() },
      order: { createdAt: 'DESC' },
    });
  }

  public findReceiptTransaction(
    userId: number,
    receiptUrl: string,
  ): Promise<FinanceTransactionEntity | null> {
    return this.transactionRepo.findOne({ where: { userId: userId.toString(), receiptUrl } });
  }

  public async updateTransaction(
    userId: number,
    id: string,
    input: UpdateTransactionDto,
  ): Promise<FinanceTransactionEntity | null> {
    const transaction = await this.getTransaction(userId, id);
    if (!transaction) return null;

    const currentAllocations = transaction.allocations || [];
    const currentAllocatedSum = currentAllocations.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    );

    if (input.type && input.type !== transaction.type) {
      if (currentAllocatedSum > 0) {
        throw new Error('Không thể đổi loại giao dịch khi đang có phân bổ công nợ.');
      }
      transaction.type = input.type;
    }
    if (input.amount !== undefined) {
      const amount = Math.round(Number(input.amount));
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Số tiền phải lớn hơn 0.');
      if (amount < currentAllocatedSum) {
        throw new Error(
          `Số tiền giao dịch mới không được nhỏ hơn tổng số tiền đã phân bổ công nợ (${this.formatMoney(currentAllocatedSum)}).`,
        );
      }
      transaction.amount = amount;
    }
    if (input.currency !== undefined) transaction.currency = input.currency.trim() || 'VND';
    if (input.category !== undefined) transaction.category = input.category.trim() || 'Khác';
    if (input.paymentMethod !== undefined)
      transaction.paymentMethod = input.paymentMethod.trim() || undefined;
    if (input.receiptUrl !== undefined)
      transaction.receiptUrl = input.receiptUrl.trim() || undefined;
    if (input.contactId !== undefined) transaction.contactId = input.contactId || undefined;
    if (input.placeId !== undefined || input.placeName !== undefined) {
      transaction.placeId = await this.resolvePlaceId(userId, input.placeId, input.placeName);
    }
    if (input.note !== undefined) {
      if (!input.note.trim()) throw new Error('Cần có nội dung cho khoản thu hoặc chi.');
      transaction.note = input.note.trim();
    }
    if (input.occurredAt !== undefined) {
      const occurredAt = new Date(input.occurredAt);
      if (Number.isNaN(occurredAt.getTime())) throw new Error('Ngày phát sinh không hợp lệ.');
      transaction.occurredAt = occurredAt;
    }
    return this.transactionRepo.save(transaction);
  }

  public async resolvePlaces(userId: number, name: string): Promise<FinancePlaceEntity[]> {
    const normalizedName = this.normalizeIdentity(name);
    if (!normalizedName) return [];
    return this.placeRepo.find({
      where: { userId: userId.toString(), normalizedName },
      order: { createdAt: 'ASC' },
    });
  }

  public listPlaces(userId: number): Promise<FinancePlaceEntity[]> {
    return this.placeRepo.find({
      where: { userId: userId.toString() },
      order: { name: 'ASC', createdAt: 'ASC' },
      take: 200,
    });
  }

  public getPlace(userId: number, id: string): Promise<FinancePlaceEntity | null> {
    return this.placeRepo.findOne({ where: { id, userId: userId.toString() } });
  }

  public async createPlace(userId: number, name: string): Promise<FinancePlaceEntity> {
    const place = await this.resolveOrCreatePlace(userId, name);
    if (!place) throw new Error('Tên nơi chốn không được để trống.');
    return place;
  }

  public async updatePlace(
    userId: number,
    id: string,
    name: string,
  ): Promise<FinancePlaceEntity | null> {
    const place = await this.getPlace(userId, id);
    if (!place) return null;
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Tên nơi chốn không được để trống.');
    const normalizedName = this.normalizeIdentity(trimmed);
    const duplicate = await this.placeRepo.findOne({
      where: { userId: userId.toString(), normalizedName },
    });
    if (duplicate && duplicate.id !== id) throw new Error('Nơi chốn này đã tồn tại.');
    place.name = trimmed;
    place.normalizedName = normalizedName;
    return this.placeRepo.save(place);
  }

  public async deletePlace(userId: number, id: string): Promise<boolean> {
    const place = await this.getPlace(userId, id);
    if (!place) return false;
    await this.placeRepo.remove(place);
    return true;
  }

  public async deleteTransaction(userId: number, id: string): Promise<boolean> {
    const transaction = await this.getTransaction(userId, id);
    if (!transaction) return false;

    const uid = userId.toString();
    const existingAllocs = await this.allocationRepo.find({
      where: { financeTransactionId: id, userId: uid },
    });

    if (existingAllocs.length > 0) {
      const debtIds = Array.from(new Set(existingAllocs.map((a) => a.debtId)));
      const debts = await this.debtRepo.find({
        where: { id: In(debtIds), userId: uid },
      });
      const debtMap = new Map(debts.map((d) => [d.id, d]));

      for (const alloc of existingAllocs) {
        const debt = debtMap.get(alloc.debtId);
        if (debt) {
          debt.remainingAmount += alloc.amount;
        }
      }

      if (debts.length > 0) {
        await this.debtRepo.save(debts);
      }

      await this.allocationRepo.delete({ financeTransactionId: id, userId: uid });
      await this.debtPaymentRepo.delete({ financeTransactionId: id, userId: uid });
    }

    await this.transactionRepo.remove(transaction);
    return true;
  }

  public getTodayRange(): { startAt: string; endAt: string } {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const value = (type: string) => parts.find((part) => part.type === type)?.value;
    const date = `${value('year')}-${value('month')}-${value('day')}`;
    return {
      startAt: `${date}T00:00:00+07:00`,
      endAt: `${date}T23:59:59.999+07:00`,
    };
  }

  public async createDebt(dto: CreateDebtDto): Promise<DebtEntity> {
    const amount = Math.round(Number(dto.amount));
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Số tiền phải lớn hơn 0.');
    let contact: DebtContactEntity | null = null;
    if (dto.contactId) {
      contact = await this.contactRepo.findOne({
        where: { id: dto.contactId, userId: dto.userId.toString() },
      });
      if (!contact) throw new Error('Không tìm thấy người liên quan đã chọn.');
    } else if (dto.createNewContact) {
      contact = await this.createContact(dto.userId, dto.counterparty, dto.counterpartyAlias);
    } else {
      throw new Error('Cần chọn người trong danh bạ hoặc xác nhận tạo người mới.');
    }
    const dueAt = dto.dueAt ? new Date(dto.dueAt) : undefined;
    if (dueAt && Number.isNaN(dueAt.getTime())) throw new Error('Ngày hẹn trả không hợp lệ.');
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) throw new Error('Ngày phát sinh không hợp lệ.');

    return this.debtRepo.save(
      this.debtRepo.create({
        userId: dto.userId.toString(),
        direction: dto.direction,
        contactId: contact.id,
        counterparty: contact.displayName,
        counterpartyAlias: contact.alias,
        originalAmount: amount,
        remainingAmount: amount,
        currency: dto.currency?.trim() || 'VND',
        note: dto.note?.trim() || '',
        occurredAt,
        dueAt,
        status: 'active',
      }),
    );
  }

  public async resolveContacts(
    userId: number,
    name: string,
    alias?: string,
  ): Promise<DebtContactEntity[]> {
    const normalizedName = this.normalizeIdentity(name);
    const normalizedAlias = alias ? this.normalizeIdentity(alias) : undefined;
    if (!normalizedName) return [];
    const where: FindOptionsWhere<DebtContactEntity> = {
      userId: userId.toString(),
      normalizedName,
    };
    if (normalizedAlias) {
      where.normalizedAlias = normalizedAlias;
    }
    return this.contactRepo.find({
      where,
      order: { createdAt: 'ASC' },
    });
  }

  public async listContacts(userId: number): Promise<DebtContactEntity[]> {
    return this.contactRepo.find({
      where: { userId: userId.toString() },
      order: { displayName: 'ASC', createdAt: 'DESC' },
      take: 200,
    });
  }

  public getContact(userId: number, id: string): Promise<DebtContactEntity | null> {
    return this.contactRepo.findOne({ where: { id, userId: userId.toString() } });
  }

  public async deleteContact(userId: number, id: string): Promise<boolean> {
    const contact = await this.getContact(userId, id);
    if (!contact) return false;
    await this.contactRepo.remove(contact);
    return true;
  }

  public async createContact(
    userId: number,
    name: string,
    alias?: string,
    descriptor?: string,
    phoneNumber?: string,
    bankAccountNumber?: string,
    bankCode?: string,
    bankName?: string,
    avatarUrl?: string,
  ): Promise<DebtContactEntity> {
    const displayName = name?.trim();
    if (!displayName) throw new Error('Cần có tên người liên quan.');
    return this.contactRepo.save(
      this.contactRepo.create({
        userId: userId.toString(),
        displayName,
        alias: alias?.trim() || undefined,
        descriptor: descriptor?.trim() || undefined,
        phoneNumber: phoneNumber?.trim() || undefined,
        bankAccountNumber: bankAccountNumber?.trim() || undefined,
        bankCode: bankCode?.trim() || undefined,
        bankName: bankName?.trim() || undefined,
        avatarUrl: avatarUrl?.trim() || undefined,
        normalizedName: this.normalizeIdentity(displayName),
        normalizedAlias: alias ? this.normalizeIdentity(alias) : undefined,
      }),
    );
  }

  private normalizeIdentity(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('vi-VN')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private async resolvePlaceId(
    userId: number,
    placeId?: string | null,
    placeName?: string,
  ): Promise<string | undefined> {
    if (placeId === null) return undefined;
    if (placeId) {
      const place = await this.getPlace(userId, placeId);
      if (!place) throw new Error('Không tìm thấy nơi chốn đã chọn.');
      return place.id;
    }
    if (placeName?.trim()) {
      return (await this.resolveOrCreatePlace(userId, placeName))?.id;
    }
    return undefined;
  }

  public async getActiveDebts(userId: number): Promise<DebtEntity[]> {
    return this.debtRepo.find({
      where: { userId: userId.toString(), status: 'active', parentDebtId: IsNull() },
      relations: { contact: true, payments: true },
      order: { occurredAt: 'DESC', createdAt: 'DESC', id: 'DESC' },
    });
  }

  public async listDebts(userId: number, status?: 'active' | 'settled'): Promise<DebtEntity[]> {
    return this.debtRepo.find({
      where: status ? { userId: userId.toString(), status } : { userId: userId.toString() },
      relations: {
        contact: true,
        payments: { financeTransaction: true },
        children: { contact: true, payments: { financeTransaction: true } },
        parentDebt: true,
      },
      order: {
        occurredAt: 'DESC',
        createdAt: 'DESC',
        id: 'DESC',
      },
      take: 200,
    });
  }

  public getDebt(userId: number, id: string): Promise<DebtEntity | null> {
    return this.debtRepo.findOne({
      where: { id, userId: userId.toString() },
      relations: {
        contact: true,
        payments: { financeTransaction: true },
        allocations: true,
        children: { contact: true, payments: { financeTransaction: true } },
        parentDebt: true,
      },
    });
  }

  public async updateDebt(
    userId: number,
    id: string,
    input: UpdateDebtDto,
  ): Promise<DebtEntity | null> {
    const debt = await this.getDebt(userId, id);
    if (!debt) return null;
    if (input.direction) debt.direction = input.direction;
    if (input.counterparty !== undefined) {
      debt.counterparty = input.counterparty.trim();
    }
    if (input.contactId !== undefined) {
      debt.contactId = input.contactId.trim() || undefined;
    }
    if (input.counterpartyAlias !== undefined) {
      debt.counterpartyAlias = input.counterpartyAlias.trim() || undefined;
    }
    if (input.originalAmount !== undefined) {
      const nextOriginal = Math.round(Number(input.originalAmount));
      if (!Number.isFinite(nextOriginal) || nextOriginal < 0) {
        throw new Error('Số tiền ban đầu không hợp lệ.');
      }
      debt.originalAmount = nextOriginal;
    }
    if (input.remainingAmount !== undefined) {
      const nextRemaining = Math.max(0, Math.round(Number(input.remainingAmount)));
      if (!Number.isFinite(nextRemaining)) {
        throw new Error('Số tiền còn lại không hợp lệ.');
      }
      debt.remainingAmount = nextRemaining;
      debt.status = debt.remainingAmount === 0 ? 'settled' : 'active';
      if (debt.status === 'settled') {
        if (!debt.settledAt) debt.settledAt = new Date();
      } else {
        debt.settledAt = undefined;
      }
    } else if (input.amount !== undefined) {
      const nextOriginalAmount = Math.round(Number(input.amount));
      const paidAmount = debt.originalAmount - debt.remainingAmount;
      if (!Number.isFinite(nextOriginalAmount) || nextOriginalAmount <= 0) {
        throw new Error('Số tiền phải lớn hơn 0.');
      }
      if (nextOriginalAmount < paidAmount) {
        throw new Error('Số tiền mới không được nhỏ hơn phần đã thanh toán.');
      }
      debt.originalAmount = nextOriginalAmount;
      debt.remainingAmount = nextOriginalAmount - paidAmount;
      debt.status = debt.remainingAmount === 0 ? 'settled' : 'active';
      if (debt.status === 'settled' && !debt.settledAt) {
        debt.settledAt = new Date();
      }
    }
    if (input.currency !== undefined) debt.currency = input.currency.trim() || 'VND';
    if (input.note !== undefined) debt.note = input.note.trim();
    if (input.occurredAt !== undefined) {
      const occurredAt = new Date(input.occurredAt);
      if (Number.isNaN(occurredAt.getTime())) throw new Error('Ngày phát sinh không hợp lệ.');
      debt.occurredAt = occurredAt;
    }
    if (input.dueAt !== undefined) {
      const dueAt = new Date(input.dueAt);
      if (Number.isNaN(dueAt.getTime())) throw new Error('Ngày hẹn trả không hợp lệ.');
      debt.dueAt = dueAt;
    }
    return this.debtRepo.save(debt);
  }

  public async listExpenses(userId: number): Promise<FinanceTransactionEntity[]> {
    return this.transactionRepo.find({
      where: { userId: userId.toString(), type: 'expense' },
      order: { occurredAt: 'DESC' },
      take: 200,
    });
  }

  public async updateContact(
    userId: number,
    contactId: string,
    name: string,
    alias?: string,
    descriptor?: string,
    phoneNumber?: string,
    bankAccountNumber?: string,
    bankCode?: string,
    bankName?: string,
    avatarUrl?: string,
  ): Promise<DebtContactEntity> {
    const contact = await this.contactRepo.findOne({
      where: { id: contactId, userId: userId.toString() },
    });
    if (!contact) throw new Error('Không tìm thấy người trong danh bạ công nợ.');
    const displayName = name?.trim();
    if (!displayName) throw new Error('Tên không được để trống.');
    contact.displayName = displayName;
    contact.alias = alias?.trim() || undefined;
    contact.descriptor = descriptor?.trim() || undefined;
    if (phoneNumber !== undefined) contact.phoneNumber = phoneNumber?.trim() || undefined;
    if (bankAccountNumber !== undefined)
      contact.bankAccountNumber = bankAccountNumber?.trim() || undefined;
    if (bankCode !== undefined) contact.bankCode = bankCode?.trim() || undefined;
    if (bankName !== undefined) contact.bankName = bankName?.trim() || undefined;
    if (avatarUrl !== undefined) contact.avatarUrl = avatarUrl?.trim() || undefined;
    contact.normalizedName = this.normalizeIdentity(displayName);
    contact.normalizedAlias = alias ? this.normalizeIdentity(alias) : undefined;
    return this.contactRepo.save(contact);
  }

  public async combineContacts(
    userId: number,
    input: CombineContactsDto,
  ): Promise<CombineContactsResult> {
    const uid = userId.toString();
    const targetContact = await this.contactRepo.findOne({
      where: { id: input.targetContactId, userId: uid },
    });
    if (!targetContact) {
      throw new Error('Không tìm thấy liên hệ đích để gộp.');
    }

    const uniqueSourceIds = Array.from(
      new Set(input.sourceContactIds.filter((id) => id !== input.targetContactId)),
    );
    if (uniqueSourceIds.length === 0) {
      return { targetContact, affectedDebtsCount: 0, mergedCount: 0 };
    }

    const sourceContacts = await this.contactRepo.find({
      where: { id: In(uniqueSourceIds), userId: uid },
    });

    if (input.displayName?.trim()) {
      targetContact.displayName = input.displayName.trim();
      targetContact.normalizedName = this.normalizeIdentity(targetContact.displayName);
    }
    if (input.alias !== undefined) {
      targetContact.alias = input.alias.trim() || undefined;
      targetContact.normalizedAlias = targetContact.alias
        ? this.normalizeIdentity(targetContact.alias)
        : undefined;
    }
    if (input.descriptor !== undefined) {
      targetContact.descriptor = input.descriptor.trim() || undefined;
    }

    await this.contactRepo.save(targetContact);

    let affectedDebtsCount = 0;
    for (const source of sourceContacts) {
      const debts = await this.debtRepo.find({
        where: { contactId: source.id, userId: uid },
      });
      if (debts.length > 0) {
        for (const debt of debts) {
          debt.contactId = targetContact.id;
          debt.counterparty = targetContact.displayName;
          debt.counterpartyAlias = targetContact.alias;
        }
        await this.debtRepo.save(debts);
        affectedDebtsCount += debts.length;
      }
    }

    if (sourceContacts.length > 0) {
      await this.contactRepo.remove(sourceContacts);
    }

    if (input.consolidateDebts) {
      const allContactDebts = await this.debtRepo.find({
        where: { contactId: targetContact.id, userId: uid, parentDebtId: IsNull() },
      });
      for (const dir of ['receivable', 'payable'] as const) {
        const dirDebts = allContactDebts.filter((d) => d.direction === dir);
        // Group by currency to avoid mismatched currency merging
        const byCurrency = new Map<string, DebtEntity[]>();
        for (const d of dirDebts) {
          const curr = (d.currency || 'VND').toUpperCase();
          const group = byCurrency.get(curr) || [];
          group.push(d);
          byCurrency.set(curr, group);
        }
        for (const [curr, group] of byCurrency) {
          if (group.length >= 2) {
            await this.combineDebts(userId, {
              debtIds: group.map((d) => d.id),
              contactId: targetContact.id,
              counterparty: targetContact.displayName,
              counterpartyAlias: targetContact.alias,
              note: `Gộp nợ ${dir === 'receivable' ? 'cho vay' : 'đi vay'} (${curr}) sau khi gộp liên hệ: ${targetContact.displayName}`,
            });
          }
        }
      }
    }

    return {
      targetContact,
      affectedDebtsCount,
      mergedCount: sourceContacts.length,
    };
  }

  public async combineDebts(userId: number, input: CombineDebtsDto): Promise<CombineDebtsResult> {
    const uid = userId.toString();
    const uniqueIds = Array.from(new Set((input.debtIds || []).filter(Boolean)));
    if (uniqueIds.length < 2) {
      throw new Error('Cần chọn ít nhất 2 khoản nợ để gộp.');
    }

    const debts = await this.debtRepo.find({
      where: { id: In(uniqueIds), userId: uid },
      relations: { contact: true, payments: true, children: true },
    });

    if (debts.length < uniqueIds.length) {
      throw new Error(
        'Một hoặc nhiều khoản nợ không tồn tại hoặc không thuộc quyền sở hữu của bạn.',
      );
    }

    const direction = debts[0].direction;
    if (debts.some((d) => d.direction !== direction)) {
      throw new Error('Chỉ có thể gộp các khoản nợ cùng chiều (cùng Phải thu hoặc cùng Phải trả).');
    }

    const currency = (debts[0].currency || 'VND').toUpperCase();
    if (debts.some((d) => (d.currency || 'VND').toUpperCase() !== currency)) {
      throw new Error('Chỉ có thể gộp các khoản nợ có cùng đơn vị tiền tệ.');
    }

    const contactId = input.contactId || debts[0].contactId;
    const counterparty = input.counterparty?.trim() || debts[0].counterparty;
    const counterpartyAlias = input.counterpartyAlias?.trim() || debts[0].counterpartyAlias;

    const originalAmount = debts.reduce((sum, d) => sum + Number(d.originalAmount || 0), 0);
    const remainingAmount = debts.reduce((sum, d) => sum + Number(d.remainingAmount || 0), 0);
    const status = remainingAmount === 0 ? 'settled' : 'active';
    const settledAt = status === 'settled' ? debts[0].settledAt || new Date() : undefined;

    let dueAt: Date | undefined;
    if (input.dueAt) {
      const parsedDue = new Date(input.dueAt);
      if (!Number.isNaN(parsedDue.getTime())) {
        dueAt = parsedDue;
      }
    }
    if (!dueAt) {
      dueAt = debts.find((d) => d.dueAt)?.dueAt;
    }

    const occurredAt =
      debts.reduce(
        (latest, d) => (d.occurredAt && (!latest || d.occurredAt > latest) ? d.occurredAt : latest),
        debts[0].occurredAt,
      ) || new Date();
    const note = input.note?.trim() || `Gộp từ ${debts.length} khoản nợ`;

    return this.debtRepo.manager.transaction(async (manager) => {
      const parentDebt = manager.create(DebtEntity, {
        userId: uid,
        contactId,
        direction,
        counterparty,
        counterpartyAlias,
        originalAmount,
        remainingAmount,
        currency,
        note,
        status,
        settledAt,
        dueAt,
        occurredAt,
      });
      const savedParent = await manager.save(DebtEntity, parentDebt);

      for (const child of debts) {
        // If child was already a parent, re-parent its existing children to the new consolidated parent
        if (child.children && child.children.length > 0) {
          for (const subChild of child.children) {
            subChild.parentDebtId = savedParent.id;
            await manager.save(DebtEntity, subChild);
          }
        }
        child.parentDebtId = savedParent.id;
        await manager.save(DebtEntity, child);
      }

      const fullParent = await manager.findOne(DebtEntity, {
        where: { id: savedParent.id },
        relations: {
          contact: true,
          children: { contact: true, payments: true },
          payments: true,
        },
      });

      return {
        parentDebt: fullParent || savedParent,
        mergedDebtsCount: debts.length,
      };
    });
  }

  public async recordDebtPayment(
    userId: number,
    debtId: string,
    amount: number,
    paymentDate?: string,
    note?: string,
  ): Promise<{ debt: DebtEntity; payment: DebtPaymentEntity }> {
    const payment = Math.round(Number(amount));
    if (!Number.isFinite(payment) || payment <= 0) throw new Error('Số tiền trả phải lớn hơn 0.');

    const pDate = paymentDate ? new Date(paymentDate) : new Date();
    if (Number.isNaN(pDate.getTime())) throw new Error('Ngày thanh toán không hợp lệ.');

    return this.transactionRepo.manager.transaction(async (manager) => {
      const debtRepo = manager.getRepository(DebtEntity);
      const debtPaymentRepo = manager.getRepository(DebtPaymentEntity);
      const transactionRepo = manager.getRepository(FinanceTransactionEntity);
      const debt = await debtRepo.findOne({
        where: { id: debtId, userId: userId.toString(), status: 'active' },
      });
      if (!debt) throw new Error('Không tìm thấy khoản nợ đang mở.');
      if (payment > debt.remainingAmount) throw new Error('Số tiền trả lớn hơn số nợ còn lại.');

      const paymentRecord = await debtPaymentRepo.save(
        debtPaymentRepo.create({
          debtId: debt.id,
          userId: userId.toString(),
          amount: payment,
          paymentDate: pDate,
          note: note?.trim() || undefined,
        }),
      );

      debt.remainingAmount -= payment;
      if (debt.remainingAmount === 0) {
        debt.status = 'settled';
        debt.settledAt = new Date();
      }
      const updatedDebt = await debtRepo.save(debt);
      const isRecovery = debt.direction === 'receivable';
      const description = `${isRecovery ? 'Thu hồi nợ từ' : 'Trả nợ cho'} ${debt.counterparty}`;

      await transactionRepo.save(
        transactionRepo.create({
          userId: userId.toString(),
          type: isRecovery ? 'income' : 'expense',
          amount: payment,
          currency: debt.currency,
          category: isRecovery ? 'Thu hồi nợ' : 'Trả nợ',
          contactId: debt.contactId || undefined,
          note: note?.trim() ? `${description}: ${note.trim()}` : description,
          occurredAt: pDate,
        }),
      );

      return { debt: updatedDebt, payment: paymentRecord };
    });
  }

  public async getDebtPayments(userId: number, debtId: string): Promise<DebtPaymentEntity[]> {
    return this.debtPaymentRepo.find({
      where: { debtId, userId: userId.toString() },
      relations: { financeTransaction: true },
      order: { paymentDate: 'DESC', createdAt: 'DESC' },
    });
  }

  public async deleteDebtPayment(
    userId: number,
    debtId: string,
    paymentId: string,
  ): Promise<boolean> {
    const uid = userId.toString();
    return this.debtRepo.manager.transaction(async (manager) => {
      const debtRepo = manager.getRepository(DebtEntity);
      const debtPaymentRepo = manager.getRepository(DebtPaymentEntity);
      const transactionRepo = manager.getRepository(FinanceTransactionEntity);

      const payment = await debtPaymentRepo.findOne({
        where: { id: paymentId, debtId, userId: uid },
      });
      if (!payment) return false;

      const debt = await debtRepo.findOne({
        where: { id: debtId, userId: uid },
      });
      if (debt) {
        debt.remainingAmount = Math.min(debt.originalAmount, debt.remainingAmount + payment.amount);
        if (debt.remainingAmount > 0) {
          debt.status = 'active';
          debt.settledAt = undefined;
        }
        await debtRepo.save(debt);

        if (debt.parentDebtId) {
          const parent = await debtRepo.findOne({
            where: { id: debt.parentDebtId, userId: uid },
            relations: { children: true },
          });
          if (parent && parent.children) {
            parent.remainingAmount = parent.children.reduce(
              (sum, c) => (c.id === debt.id ? sum + debt.remainingAmount : sum + c.remainingAmount),
              0,
            );
            if (parent.remainingAmount > 0) {
              parent.status = 'active';
              parent.settledAt = undefined;
            }
            await debtRepo.save(parent);
          }
        }
      }

      if (payment.financeTransactionId) {
        const tx = await transactionRepo.findOne({
          where: { id: payment.financeTransactionId, userId: uid },
        });
        if (tx) {
          await transactionRepo.remove(tx);
        }
      }

      await debtPaymentRepo.remove(payment);
      return true;
    });
  }

  public async listCandidateDebts(
    userId: number,
    transactionId: string,
  ): Promise<ICandidateDebtItem[]> {
    const uid = userId.toString();
    const transaction = await this.transactionRepo.findOne({
      where: { id: transactionId, userId: uid },
      relations: { contact: true },
    });
    if (!transaction) {
      throw new Error('Không tìm thấy giao dịch.');
    }

    const targetDirection = transaction.type === 'income' ? 'receivable' : 'payable';

    const existingAllocations = await this.allocationRepo.find({
      where: { financeTransactionId: transactionId, userId: uid },
    });
    const allocatedMap = new Map<string, number>();
    for (const alloc of existingAllocations) {
      allocatedMap.set(alloc.debtId, (allocatedMap.get(alloc.debtId) || 0) + alloc.amount);
    }

    const where: FindOptionsWhere<DebtEntity> = {
      userId: uid,
      direction: targetDirection,
    };
    if (transaction.contactId) {
      where.contactId = transaction.contactId;
    }

    const debts = await this.debtRepo.find({
      where,
      relations: { contact: true },
      order: { occurredAt: 'DESC', createdAt: 'DESC' },
    });

    const candidates: ICandidateDebtItem[] = [];
    for (const debt of debts) {
      const currentAllocated = allocatedMap.get(debt.id) || 0;
      const availableRemaining = debt.remainingAmount + currentAllocated;

      if (availableRemaining <= 0 && currentAllocated === 0) {
        continue;
      }

      candidates.push({
        id: debt.id,
        direction: debt.direction,
        counterparty: debt.contact?.displayName || debt.counterparty,
        counterpartyAlias: debt.contact?.alias || debt.counterpartyAlias,
        contactId: debt.contactId,
        originalAmount: debt.originalAmount,
        remainingAmount: availableRemaining,
        currentAllocatedAmount: currentAllocated,
        note: debt.note,
        occurredAt: debt.occurredAt?.toISOString() || debt.createdAt.toISOString(),
        dueAt: debt.dueAt?.toISOString(),
        status: debt.status,
      });
    }

    return candidates;
  }

  public async getTransactionAllocations(
    userId: number,
    transactionId: string,
  ): Promise<IDebtAllocationItem[]> {
    const uid = userId.toString();
    const allocations = await this.allocationRepo.find({
      where: { financeTransactionId: transactionId, userId: uid },
      relations: { debt: { contact: true } },
      order: { createdAt: 'ASC' },
    });

    return allocations.map((alloc) => ({
      id: alloc.id,
      userId: alloc.userId,
      financeTransactionId: alloc.financeTransactionId,
      debtId: alloc.debtId,
      amount: alloc.amount,
      allocatedAt: (alloc.allocatedAt || new Date()).toISOString(),
      note: alloc.note,
      createdAt: (alloc.createdAt || new Date()).toISOString(),
      debt: alloc.debt
        ? {
            counterparty: alloc.debt.contact?.displayName || alloc.debt.counterparty,
            counterpartyAlias: alloc.debt.contact?.alias || alloc.debt.counterpartyAlias,
            direction: alloc.debt.direction,
            remainingAmount: alloc.debt.remainingAmount,
            originalAmount: alloc.debt.originalAmount,
          }
        : undefined,
    }));
  }

  public async allocateTransactionToDebts(
    userId: number,
    transactionId: string,
    allocations: Array<{ debtId: string; amount: number; note?: string }>,
  ): Promise<{ allocations: IDebtAllocationItem[]; remainingUnallocated: number }> {
    const uid = userId.toString();
    return this.transactionRepo.manager.transaction(async (manager) => {
      const txRepo = manager.getRepository(FinanceTransactionEntity);
      const debtRepo = manager.getRepository(DebtEntity);
      const allocRepo = manager.getRepository(DebtPaymentAllocationEntity);
      const debtPaymentRepo = manager.getRepository(DebtPaymentEntity);

      const tx = await txRepo.findOne({
        where: { id: transactionId, userId: uid },
      });
      if (!tx) {
        throw new Error('Không tìm thấy giao dịch thu/chi.');
      }

      const validItems = allocations
        .filter((item) => Number(item.amount) > 0)
        .map((item) => ({
          debtId: item.debtId.trim(),
          amount: Math.round(Number(item.amount)),
          note: item.note?.trim() || undefined,
        }));

      const seenDebtIds = new Set<string>();
      for (const item of validItems) {
        if (seenDebtIds.has(item.debtId)) {
          throw new Error('Không được phân bổ trùng lặp vào cùng một khoản nợ.');
        }
        seenDebtIds.add(item.debtId);
      }

      const totalRequested = validItems.reduce((sum, item) => sum + item.amount, 0);
      if (totalRequested > tx.amount) {
        throw new Error(
          `Tổng tiền phân bổ (${this.formatMoney(totalRequested)}) vượt quá số tiền giao dịch (${this.formatMoney(tx.amount)}).`,
        );
      }

      const existingAllocs = await allocRepo.find({
        where: { financeTransactionId: transactionId, userId: uid },
      });

      const allDebtIds = Array.from(
        new Set([...existingAllocs.map((a) => a.debtId), ...validItems.map((v) => v.debtId)]),
      );

      const debts =
        allDebtIds.length > 0
          ? await debtRepo.find({
              where: { id: In(allDebtIds), userId: uid },
              relations: { contact: true },
            })
          : [];
      const debtMap = new Map(debts.map((d) => [d.id, d]));

      // 1. Revert previous allocations on debts
      for (const existing of existingAllocs) {
        const debt = debtMap.get(existing.debtId);
        if (debt) {
          debt.remainingAmount += existing.amount;
        }
      }

      // 2. Clear previous allocations and linked payments
      await allocRepo.delete({ financeTransactionId: transactionId, userId: uid });
      await debtPaymentRepo.delete({ financeTransactionId: transactionId, userId: uid });

      // 3. Apply new allocations
      const expectedDirection = tx.type === 'income' ? 'receivable' : 'payable';
      const savedAllocations: DebtPaymentAllocationEntity[] = [];

      for (const item of validItems) {
        const debt = debtMap.get(item.debtId);
        if (!debt) {
          throw new Error(`Không tìm thấy khoản nợ: ${item.debtId}`);
        }
        if (debt.direction !== expectedDirection) {
          throw new Error(
            `Khoản nợ của ${debt.counterparty} (${debt.direction}) không khớp với chiều giao dịch (${tx.type}).`,
          );
        }
        if (item.amount > debt.remainingAmount) {
          throw new Error(
            `Số tiền phân bổ (${this.formatMoney(item.amount)}) vượt quá số nợ còn lại (${this.formatMoney(debt.remainingAmount)}) của ${debt.counterparty}.`,
          );
        }

        debt.remainingAmount -= item.amount;
        if (debt.remainingAmount === 0) {
          debt.status = 'settled';
          debt.settledAt = new Date();
        } else {
          debt.status = 'active';
          debt.settledAt = undefined;
        }

        const allocEntity = await allocRepo.save(
          allocRepo.create({
            userId: uid,
            financeTransactionId: tx.id,
            debtId: debt.id,
            amount: item.amount,
            allocatedAt: tx.occurredAt || new Date(),
            note: item.note,
          }),
        );
        allocEntity.debt = debt;
        savedAllocations.push(allocEntity);

        await debtPaymentRepo.save(
          debtPaymentRepo.create({
            debtId: debt.id,
            userId: uid,
            financeTransactionId: tx.id,
            amount: item.amount,
            paymentDate: tx.occurredAt || new Date(),
            note: item.note || tx.note || undefined,
          }),
        );
      }

      for (const d of debtMap.values()) {
        if (d.remainingAmount === 0) {
          d.status = 'settled';
          if (!d.settledAt) d.settledAt = new Date();
        } else {
          d.status = 'active';
          d.settledAt = undefined;
        }
        await debtRepo.save(d);
      }

      return {
        allocations: savedAllocations.map((alloc) => ({
          id: alloc.id,
          userId: alloc.userId,
          financeTransactionId: alloc.financeTransactionId,
          debtId: alloc.debtId,
          amount: alloc.amount,
          allocatedAt: (alloc.allocatedAt || new Date()).toISOString(),
          note: alloc.note,
          createdAt: (alloc.createdAt || new Date()).toISOString(),
          debt: alloc.debt
            ? {
                counterparty: alloc.debt.contact?.displayName || alloc.debt.counterparty,
                counterpartyAlias: alloc.debt.contact?.alias || alloc.debt.counterpartyAlias,
                direction: alloc.debt.direction,
                remainingAmount: alloc.debt.remainingAmount,
                originalAmount: alloc.debt.originalAmount,
              }
            : undefined,
        })),
        remainingUnallocated: tx.amount - totalRequested,
      };
    });
  }

  public async deleteDebtAllocation(
    userId: number,
    transactionId: string,
    allocationId: string,
  ): Promise<boolean> {
    const uid = userId.toString();
    return this.transactionRepo.manager.transaction(async (manager) => {
      const allocRepo = manager.getRepository(DebtPaymentAllocationEntity);
      const debtRepo = manager.getRepository(DebtEntity);
      const debtPaymentRepo = manager.getRepository(DebtPaymentEntity);

      const alloc = await allocRepo.findOne({
        where: { id: allocationId, financeTransactionId: transactionId, userId: uid },
      });
      if (!alloc) return false;

      const debt = await debtRepo.findOne({
        where: { id: alloc.debtId, userId: uid },
      });
      if (debt) {
        debt.remainingAmount += alloc.amount;
        if (debt.remainingAmount > 0) {
          debt.status = 'active';
          debt.settledAt = undefined;
        }
        await debtRepo.save(debt);
      }

      await debtPaymentRepo.delete({
        financeTransactionId: transactionId,
        debtId: alloc.debtId,
        userId: uid,
        amount: alloc.amount,
      });

      await allocRepo.remove(alloc);
      return true;
    });
  }

  public async deleteDebt(userId: number, debtId: string): Promise<boolean> {
    const debt = await this.debtRepo.findOne({
      where: { id: debtId, userId: userId.toString() },
    });
    if (!debt) return false;
    await this.debtRepo.remove(debt);
    return true;
  }

  public async listCategories(
    userId: number,
    type?: 'income' | 'expense',
  ): Promise<UserCategoryEntity[]> {
    const uid = userId.toString();
    const count = await this.userCategoryRepo.count({ where: { userId: uid } });
    if (count === 0) {
      await this.seedDefaultCategories(userId);
    }

    const where: { userId: string; type?: 'income' | 'expense' } = { userId: uid };
    if (type) {
      where.type = type;
    }
    return this.userCategoryRepo.find({
      where,
      order: { createdAt: 'ASC' },
    });
  }

  public async seedDefaultCategories(userId: number): Promise<void> {
    const uid = userId.toString();
    const entities: UserCategoryEntity[] = [];

    for (const name of DEFAULT_EXPENSE_CATEGORIES) {
      entities.push(
        this.userCategoryRepo.create({
          userId: uid,
          type: 'expense',
          name,
          isDefault: true,
        }),
      );
    }

    for (const name of DEFAULT_INCOME_CATEGORIES) {
      entities.push(
        this.userCategoryRepo.create({
          userId: uid,
          type: 'income',
          name,
          isDefault: true,
        }),
      );
    }

    await this.userCategoryRepo.save(entities);
  }

  public async createCategory(
    userId: number,
    input: ICreateCategoryRequest,
  ): Promise<UserCategoryEntity> {
    const uid = userId.toString();
    const name = input.name?.trim();
    if (!name) {
      throw new Error('Tên danh mục không được để trống.');
    }

    const existing = await this.userCategoryRepo.findOne({
      where: { userId: uid, type: input.type, name },
    });
    if (existing) {
      throw new Error('Danh mục này đã tồn tại.');
    }

    const category = this.userCategoryRepo.create({
      userId: uid,
      type: input.type,
      name,
      color: input.color?.trim() || undefined,
      icon: input.icon?.trim() || undefined,
      isDefault: false,
    });
    return this.userCategoryRepo.save(category);
  }

  public async updateCategory(
    userId: number,
    id: string,
    input: IUpdateCategoryRequest,
  ): Promise<UserCategoryEntity | null> {
    const uid = userId.toString();
    const category = await this.userCategoryRepo.findOne({
      where: { id, userId: uid },
    });
    if (!category) return null;

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new Error('Tên danh mục không được để trống.');
      }
      const existing = await this.userCategoryRepo.findOne({
        where: { userId: uid, type: category.type, name },
      });
      if (existing && existing.id !== id) {
        throw new Error('Tên danh mục này đã tồn tại.');
      }
      category.name = name;
    }

    if (input.color !== undefined) {
      category.color = input.color?.trim() || undefined;
    }

    if (input.icon !== undefined) {
      category.icon = input.icon?.trim() || undefined;
    }

    return this.userCategoryRepo.save(category);
  }

  public async deleteCategory(userId: number, id: string): Promise<boolean> {
    const uid = userId.toString();
    const category = await this.userCategoryRepo.findOne({
      where: { id, userId: uid },
    });
    if (!category) return false;
    await this.userCategoryRepo.remove(category);
    return true;
  }

  public formatMoney(amount: number): string {
    return `${new Intl.NumberFormat('vi-VN').format(amount)}đ`;
  }
}

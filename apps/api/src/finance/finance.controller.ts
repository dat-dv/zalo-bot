import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Response } from 'express';
import type { AnalyticsGrain } from '@zalobot/contracts';
import { getDashboardUserId } from '../dashboard-auth/dashboard-user';
import { ReportsTokenService } from '../reports/reports-token.service';
import { FinanceService } from './finance.service';

type RecordBody = Record<string, unknown>;

function toIsoDate(value: unknown, fallback?: string): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return fallback ?? new Date().toISOString();
}

function toOptionalIsoDate(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
}

@ApiTags('Finance & Transactions')
@ApiBearerAuth('bearer-jwt')
@Controller()
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly tokens: ReportsTokenService,
  ) {}

  @Get('finance/analytics')
  @ApiOperation({ summary: 'Lấy dữ liệu phân tích báo cáo tài chính trực quan' })
  async getAnalytics(
    @Req() req: Request,
    @Query('startAt') startAt?: string,
    @Query('endAt') endAt?: string,
    @Query('grain') grain?: AnalyticsGrain,
  ) {
    const data = await this.finance.getAnalyticsReport(this.userId(req), startAt, endAt, grain);
    return { data };
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Lấy danh sách giao dịch thu/chi' })
  async listTransactions(@Req() req: Request, @Query('type') type?: 'income' | 'expense') {
    return { data: await this.finance.listTransactions(this.userId(req), type) };
  }

  @Get('transactions/:id')
  async getTransaction(@Req() req: Request, @Param('id') id: string) {
    return { data: await this.required(this.finance.getTransaction(this.userId(req), id)) };
  }

  @Post('transactions')
  async createTransaction(@Req() req: Request, @Body() body: RecordBody) {
    return {
      data: await this.finance.createTransaction({
        ...this.transactionInput(body),
        userId: this.userId(req),
      }),
    };
  }

  @Patch('transactions/:id')
  async updateTransaction(@Req() req: Request, @Param('id') id: string, @Body() body: RecordBody) {
    return {
      data: await this.required(
        this.finance.updateTransaction(this.userId(req), id, this.transactionInput(body, true)),
      ),
    };
  }

  @Delete('transactions/:id')
  async deleteTransaction(@Req() req: Request, @Param('id') id: string) {
    if (!(await this.finance.deleteTransaction(this.userId(req), id)))
      throw new NotFoundException();
    return { data: { deleted: true } };
  }

  @Get('transactions/:id/candidate-debts')
  @ApiOperation({ summary: 'Lấy danh sách công nợ ứng viên cho giao dịch' })
  async listCandidateDebts(@Req() req: Request, @Param('id') id: string) {
    return { data: await this.finance.listCandidateDebts(this.userId(req), id) };
  }

  @Get('transactions/:id/allocations')
  @ApiOperation({ summary: 'Lấy danh sách phân bổ công nợ của giao dịch' })
  async getTransactionAllocations(@Req() req: Request, @Param('id') id: string) {
    return { data: await this.finance.getTransactionAllocations(this.userId(req), id) };
  }

  @Post('transactions/:id/allocations')
  @ApiOperation({ summary: 'Lưu phân bổ giao dịch vào các khoản công nợ' })
  async allocateTransactionToDebts(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: RecordBody,
  ) {
    const rawAllocations = Array.isArray(body.allocations) ? body.allocations : [];
    const allocations = rawAllocations.map((item) => {
      const rec = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      return {
        debtId: this.string(rec.debtId, 'debtId'),
        amount: this.number(rec.amount, 'amount'),
        note: this.optionalString(rec.note),
      };
    });
    return {
      data: await this.finance.allocateTransactionToDebts(this.userId(req), id, allocations),
    };
  }

  @Delete('transactions/:id/allocations/:allocationId')
  @ApiOperation({ summary: 'Xóa một phân bổ công nợ của giao dịch' })
  async deleteDebtAllocation(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('allocationId') allocationId: string,
  ) {
    if (!(await this.finance.deleteDebtAllocation(this.userId(req), id, allocationId))) {
      throw new NotFoundException();
    }
    return { data: { deleted: true } };
  }

  @Get('categories')
  @ApiOperation({ summary: 'Lấy danh sách danh mục thu/chi' })
  async listCategories(@Req() req: Request, @Query('type') type?: 'income' | 'expense') {
    const categories = await this.finance.listCategories(this.userId(req), type);
    return {
      data: categories.map((cat) => ({
        id: cat.id,
        type: cat.type,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        isDefault: cat.isDefault,
        createdAt: toIsoDate(cat.createdAt),
        updatedAt: toOptionalIsoDate(cat.updatedAt),
      })),
    };
  }

  @Post('categories')
  @ApiOperation({ summary: 'Tạo danh mục thu/chi mới' })
  async createCategory(@Req() req: Request, @Body() body: RecordBody) {
    const type = this.string(body.type, 'type');
    if (type !== 'income' && type !== 'expense') {
      throw new BadRequestException('Loại danh mục phải là income hoặc expense.');
    }
    const name = this.string(body.name, 'name');
    const color = this.optionalString(body.color);
    const icon = this.optionalString(body.icon);
    const cat = await this.finance.createCategory(this.userId(req), {
      type,
      name,
      color,
      icon,
    });
    return {
      data: {
        id: cat.id,
        type: cat.type,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        isDefault: cat.isDefault,
        createdAt: toIsoDate(cat.createdAt),
        updatedAt: toOptionalIsoDate(cat.updatedAt),
      },
    };
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Cập nhật danh mục thu/chi' })
  async updateCategory(@Req() req: Request, @Param('id') id: string, @Body() body: RecordBody) {
    const name = this.optionalString(body.name);
    const color = this.optionalString(body.color);
    const icon = this.optionalString(body.icon);
    const cat = await this.finance.updateCategory(this.userId(req), id, {
      name,
      color,
      icon,
    });
    if (!cat) throw new NotFoundException('Không tìm thấy danh mục.');
    return {
      data: {
        id: cat.id,
        type: cat.type,
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        isDefault: cat.isDefault,
        createdAt: toIsoDate(cat.createdAt),
        updatedAt: toOptionalIsoDate(cat.updatedAt),
      },
    };
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Xóa danh mục thu/chi' })
  async deleteCategory(@Req() req: Request, @Param('id') id: string) {
    const deleted = await this.finance.deleteCategory(this.userId(req), id);
    if (!deleted) throw new NotFoundException('Không tìm thấy danh mục.');
    return { data: { deleted: true } };
  }

  @Get('places')
  @ApiOperation({ summary: 'Lấy danh sách nơi chốn/cửa hàng' })
  async listPlaces(@Req() req: Request) {
    const places = await this.finance.listPlaces(this.userId(req));
    return { data: places.map((place) => this.placeResponse(place)) };
  }

  @Post('places')
  @ApiOperation({ summary: 'Tạo nơi chốn/cửa hàng' })
  async createPlace(@Req() req: Request, @Body() body: RecordBody) {
    return {
      data: this.placeResponse(
        await this.finance.createPlace(this.userId(req), this.string(body.name, 'name')),
      ),
    };
  }

  @Patch('places/:id')
  @ApiOperation({ summary: 'Cập nhật nơi chốn/cửa hàng' })
  async updatePlace(@Req() req: Request, @Param('id') id: string, @Body() body: RecordBody) {
    const place = await this.finance.updatePlace(
      this.userId(req),
      id,
      this.string(body.name, 'name'),
    );
    if (!place) throw new NotFoundException('Không tìm thấy nơi chốn.');
    return { data: this.placeResponse(place) };
  }

  @Delete('places/:id')
  @ApiOperation({ summary: 'Xóa nơi chốn/cửa hàng' })
  async deletePlace(@Req() req: Request, @Param('id') id: string) {
    if (!(await this.finance.deletePlace(this.userId(req), id))) {
      throw new NotFoundException('Không tìm thấy nơi chốn.');
    }
    return { data: { deleted: true } };
  }

  @Post('places/combine')
  @ApiOperation({ summary: 'Gộp nhiều nơi chốn/địa điểm thành một nơi chốn chính' })
  async combinePlaces(@Req() req: Request, @Body() body: RecordBody) {
    const rawPlaceIds = Array.isArray(body.placeIds)
      ? body.placeIds.filter(
          (item): item is string => typeof item === 'string' && Boolean(item.trim()),
        )
      : [];
    const targetPlaceId = this.optionalString(body.targetPlaceId);
    const rawSourceIds = Array.isArray(body.sourcePlaceIds)
      ? body.sourcePlaceIds.filter(
          (item): item is string => typeof item === 'string' && Boolean(item.trim()),
        )
      : [];

    const placeIds = Array.from(
      new Set([...rawPlaceIds, ...(targetPlaceId ? [targetPlaceId] : []), ...rawSourceIds]),
    );

    if (placeIds.length < 2) {
      throw new BadRequestException(
        'placeIds must contain at least 2 distinct place ids to combine.',
      );
    }

    const result = await this.finance.combinePlaces(this.userId(req), {
      placeIds,
      targetPlaceId,
      name: this.optionalString(body.name),
    });

    return {
      data: {
        leadPlace: this.placeResponse(result.leadPlace),
        mergedPlacesCount: result.mergedPlacesCount,
        affectedTransactionsCount: result.affectedTransactionsCount,
      },
    };
  }

  @Get('contacts/:id')
  async getContact(@Req() req: Request, @Param('id') id: string) {
    return { data: await this.required(this.finance.getContact(this.userId(req), id)) };
  }

  @Post('contacts')
  async createContact(@Req() req: Request, @Body() body: RecordBody) {
    return {
      data: await this.finance.createContact(
        this.userId(req),
        this.string(body.displayName, 'displayName'),
        this.optionalString(body.alias),
        this.optionalString(body.descriptor),
        this.optionalString(body.phoneNumber),
        this.optionalString(body.bankAccountNumber),
        this.optionalString(body.bankCode),
        this.optionalString(body.bankName),
        this.optionalString(body.avatarUrl),
        body.linkedUserId === null ? null : this.optionalString(body.linkedUserId),
      ),
    };
  }

  @Patch('contacts/:id')
  async updateContact(@Req() req: Request, @Param('id') id: string, @Body() body: RecordBody) {
    return {
      data: await this.finance.updateContact(
        this.userId(req),
        id,
        this.string(body.displayName, 'displayName'),
        this.optionalString(body.alias),
        this.optionalString(body.descriptor),
        this.optionalString(body.phoneNumber),
        this.optionalString(body.bankAccountNumber),
        this.optionalString(body.bankCode),
        this.optionalString(body.bankName),
        this.optionalString(body.avatarUrl),
        body.linkedUserId === null ? null : this.optionalString(body.linkedUserId),
      ),
    };
  }

  @Post('contacts/combine')
  @ApiOperation({ summary: 'Gộp nhiều liên hệ thành một liên hệ chính' })
  async combineContacts(@Req() req: Request, @Body() body: RecordBody) {
    const targetContactId = this.optionalString(body.targetContactId);
    const rawSourceContactIds = Array.isArray(body.sourceContactIds)
      ? body.sourceContactIds.filter(
          (item): item is string => typeof item === 'string' && Boolean(item.trim()),
        )
      : [];
    const rawContactIds = Array.isArray(body.contactIds)
      ? body.contactIds.filter(
          (item): item is string => typeof item === 'string' && Boolean(item.trim()),
        )
      : [];

    const contactIds = Array.from(
      new Set([
        ...rawContactIds,
        ...(targetContactId ? [targetContactId] : []),
        ...rawSourceContactIds,
      ]),
    );

    if (contactIds.length < 2) {
      throw new BadRequestException('Phải chọn ít nhất 2 người liên quan để gộp.');
    }

    const result = await this.finance.combineContacts(this.userId(req), {
      targetContactId,
      sourceContactIds: rawSourceContactIds,
      contactIds,
      displayName: this.optionalString(body.displayName),
      alias: this.optionalString(body.alias),
      descriptor: this.optionalString(body.descriptor),
      linkedUserId: body.linkedUserId === null ? null : this.optionalString(body.linkedUserId),
      consolidateDebts: body.consolidateDebts === true,
    });

    return {
      data: {
        targetContact: {
          id: result.targetContact.id,
          displayName: result.targetContact.displayName,
          alias: result.targetContact.alias,
          descriptor: result.targetContact.descriptor,
          phoneNumber: result.targetContact.phoneNumber,
          bankAccountNumber: result.targetContact.bankAccountNumber,
          bankCode: result.targetContact.bankCode,
          bankName: result.targetContact.bankName,
          avatarUrl: result.targetContact.avatarUrl,
          linkedUserId: result.targetContact.linkedUserId,
          createdAt: toIsoDate(result.targetContact.createdAt),
          updatedAt: toOptionalIsoDate(result.targetContact.updatedAt),
        },
        affectedDebtsCount: result.affectedDebtsCount,
        affectedTransactionsCount: result.affectedTransactionsCount,
        mergedCount: result.mergedCount,
      },
    };
  }

  @Post('debts/combine')
  @ApiOperation({ summary: 'Gộp nhiều khoản nợ thành một khoản nợ cha' })
  async combineDebts(@Req() req: Request, @Body() body: RecordBody) {
    const debtIds = Array.isArray(body.debtIds)
      ? body.debtIds.filter(
          (item): item is string => typeof item === 'string' && Boolean(item.trim()),
        )
      : [];
    if (debtIds.length < 2) {
      throw new BadRequestException('debtIds must contain at least 2 debt IDs to combine.');
    }

    const result = await this.finance.combineDebts(this.userId(req), {
      debtIds,
      counterparty: this.optionalString(body.counterparty),
      counterpartyAlias: this.optionalString(body.counterpartyAlias),
      contactId: this.optionalString(body.contactId),
      note: this.optionalString(body.note),
      dueAt: this.optionalString(body.dueAt),
    });

    const parent = result.parentDebt;
    return {
      data: {
        parentDebt: {
          id: parent.id,
          direction: parent.direction,
          counterparty: parent.counterparty,
          counterpartyAlias: parent.counterpartyAlias,
          contactId: parent.contactId,
          parentDebtId: parent.parentDebtId,
          originalAmount: parent.originalAmount,
          remainingAmount: parent.remainingAmount,
          status: parent.status || (parent.remainingAmount === 0 ? 'settled' : 'active'),
          currency: parent.currency,
          note: parent.note || undefined,
          occurredAt: toIsoDate(parent.occurredAt || parent.createdAt),
          dueAt: toOptionalIsoDate(parent.dueAt),
          settledAt: toOptionalIsoDate(parent.settledAt),
          createdAt: toIsoDate(parent.createdAt),
          updatedAt: toOptionalIsoDate(parent.updatedAt),
          childCount: parent.children?.length || result.mergedDebtsCount,
          children: parent.children?.map((child) => ({
            id: child.id,
            direction: child.direction,
            counterparty: child.counterparty,
            counterpartyAlias: child.counterpartyAlias,
            contactId: child.contactId,
            parentDebtId: child.parentDebtId,
            originalAmount: child.originalAmount,
            remainingAmount: child.remainingAmount,
            status: child.status || (child.remainingAmount === 0 ? 'settled' : 'active'),
            currency: child.currency,
            note: child.note || undefined,
            occurredAt: toIsoDate(child.occurredAt || child.createdAt),
            dueAt: toOptionalIsoDate(child.dueAt),
            settledAt: toOptionalIsoDate(child.settledAt),
            createdAt: toIsoDate(child.createdAt),
            updatedAt: toOptionalIsoDate(child.updatedAt),
          })),
        },
        mergedDebtsCount: result.mergedDebtsCount,
      },
    };
  }

  @Delete('contacts/:id')
  async deleteContact(@Req() req: Request, @Param('id') id: string) {
    if (!(await this.finance.deleteContact(this.userId(req), id))) throw new NotFoundException();
    return { data: { deleted: true } };
  }

  @Get('debts/:id')
  async getDebt(@Req() req: Request, @Param('id') id: string) {
    return { data: await this.required(this.finance.getDebt(this.userId(req), id)) };
  }

  @Post('debts')
  async createDebt(@Req() req: Request, @Body() body: RecordBody) {
    const direction = this.enum(body.direction, ['receivable', 'payable'] as const, 'direction');
    return {
      data: await this.finance.createDebt({
        userId: this.userId(req),
        direction,
        counterparty: this.string(body.counterparty, 'counterparty'),
        counterpartyAlias: this.optionalString(body.counterpartyAlias),
        contactId: this.optionalString(body.contactId),
        createNewContact: body.createNewContact === true,
        amount: this.number(body.amount, 'amount'),
        currency: this.optionalString(body.currency),
        note: this.optionalString(body.note),
        occurredAt: this.optionalString(body.occurredAt),
        dueAt: this.optionalString(body.dueAt),
      }),
    };
  }

  @Patch('debts/:id')
  async updateDebt(@Req() req: Request, @Param('id') id: string, @Body() body: RecordBody) {
    return {
      data: await this.required(
        this.finance.updateDebt(this.userId(req), id, {
          direction:
            body.direction === undefined
              ? undefined
              : this.enum(body.direction, ['receivable', 'payable'] as const, 'direction'),
          counterparty: this.optionalString(body.counterparty),
          counterpartyAlias: this.optionalString(body.counterpartyAlias),
          contactId: this.optionalString(body.contactId),
          originalAmount:
            body.originalAmount === undefined
              ? undefined
              : this.number(body.originalAmount, 'originalAmount'),
          remainingAmount:
            body.remainingAmount === undefined
              ? undefined
              : this.number(body.remainingAmount, 'remainingAmount'),
          amount: body.amount === undefined ? undefined : this.number(body.amount, 'amount'),
          currency: this.optionalString(body.currency),
          note: this.optionalString(body.note),
          occurredAt: this.optionalString(body.occurredAt),
          dueAt: this.optionalString(body.dueAt),
        }),
      ),
    };
  }

  @Get('debts/:id/payments')
  @ApiOperation({ summary: 'Lấy lịch sử thanh toán của khoản nợ' })
  async getDebtPayments(@Req() req: Request, @Param('id') id: string) {
    return {
      data: await this.finance.getDebtPayments(this.userId(req), id),
    };
  }

  @Post('debts/:id/payments')
  @ApiOperation({ summary: 'Ghi nhận một lần thanh toán nợ' })
  async recordPayment(@Req() req: Request, @Param('id') id: string, @Body() body: RecordBody) {
    return {
      data: await this.finance.recordDebtPayment(
        this.userId(req),
        id,
        this.number(body.amount, 'amount'),
        this.optionalString(body.paymentDate),
        this.optionalString(body.note),
      ),
    };
  }

  @Delete('debts/:id/payments/:paymentId')
  @ApiOperation({ summary: 'Xóa đợt thanh toán nợ' })
  async deleteDebtPayment(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
  ) {
    if (!(await this.finance.deleteDebtPayment(this.userId(req), id, paymentId))) {
      throw new NotFoundException();
    }
    return { data: { deleted: true } };
  }

  @Delete('debts/:id')
  async deleteDebt(@Req() req: Request, @Param('id') id: string) {
    if (!(await this.finance.deleteDebt(this.userId(req), id))) throw new NotFoundException();
    return { data: { deleted: true } };
  }

  private userId(req: Request): string | number {
    return getDashboardUserId(req, this.tokens);
  }
  private async required<T>(result: Promise<T | null>): Promise<T> {
    const value = await result;
    if (!value) throw new NotFoundException();
    return value;
  }
  private string(value: unknown, name: string): string {
    if (typeof value !== 'string' || !value.trim())
      throw new BadRequestException(`${name} is required.`);
    return value.trim();
  }
  private optionalString(value: unknown): string | undefined {
    return value === undefined || value === null ? undefined : this.string(value, 'value');
  }
  private number(value: unknown, name: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0)
      throw new BadRequestException(`${name} must be a positive number.`);
    return parsed;
  }
  private enum<T extends readonly string[]>(value: unknown, values: T, name: string): T[number] {
    if (typeof value !== 'string' || !values.includes(value))
      throw new BadRequestException(`${name} is invalid.`);
    return value;
  }
  private placeResponse(place: {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt?: Date;
    transactionCount?: number;
  }) {
    return {
      id: place.id,
      name: place.name,
      transactionCount: place.transactionCount ?? 0,
      createdAt: toIsoDate(place.createdAt),
      updatedAt: toOptionalIsoDate(place.updatedAt),
    };
  }
  private transactionInput(body: RecordBody, partial = false) {
    return {
      type:
        body.type === undefined && partial
          ? undefined
          : this.enum(body.type, ['income', 'expense'] as const, 'type'),
      amount: body.amount === undefined && partial ? undefined : this.number(body.amount, 'amount'),
      currency: this.optionalString(body.currency),
      category: this.optionalString(body.category),
      paymentMethod: this.optionalString(body.paymentMethod),
      receiptUrl: this.optionalString(body.receiptUrl),
      contactId: this.optionalString(body.contactId),
      placeId:
        body.placeId === null
          ? null
          : body.placeId === undefined
            ? undefined
            : this.string(body.placeId, 'placeId'),
      placeName: this.optionalString(body.placeName),
      note: body.note === undefined && partial ? undefined : this.string(body.note, 'note'),
      occurredAt: this.optionalString(body.occurredAt),
    };
  }
}

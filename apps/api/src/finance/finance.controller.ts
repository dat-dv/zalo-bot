import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  Logger,
  NotFoundException,
  Optional,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  forwardRef,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import type { AnalyticsGrain, ITransactionListQuery } from '@zalobot/contracts';
import { GoogleDriveService } from '../google/google-drive.service';
import {
  getDashboardUserId,
  getDashboardUserIdFromBrowser,
} from '../dashboard-auth/dashboard-user';
import { ReportsTokenService } from '../reports/reports-token.service';
import { UsersService } from '../users/users.service';
import { FinanceService } from './finance.service';
import { ContactUserSyncService } from './contact-user-sync.service';
import { downloadDriveReceipt, parseReceiptSource } from './receipt-source';

/** Receipt proxy limits: receipts are phone photos, far below this. */
const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
const RECEIPT_FETCH_TIMEOUT_MS = 10_000;
/** Cap on values per multi-select list filter, keeping the IN (...) clause bounded. */
const TRANSACTION_FILTER_MAX_VALUES = 50;

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
    @Inject(forwardRef(() => UsersService))
    private readonly users: UsersService,
    private readonly contactUserSync: ContactUserSyncService,
    @Optional() private readonly moduleRef?: ModuleRef,
  ) {}

  private readonly logger = new Logger(FinanceController.name);

  /**
   * Streams a transaction's receipt image. Opened directly by `<img src>`, so it also accepts the
   * dashboard refresh cookie. Drive files are read with the creator's Google token.
   */
  @Get('transactions/:id/receipt')
  @ApiOperation({ summary: 'Xem ảnh hoá đơn của giao dịch' })
  async getTransactionReceipt(@Req() req: Request, @Res() res: Response, @Param('id') id: string) {
    getDashboardUserIdFromBrowser(req, this.tokens);
    const tx = await this.finance.getTransaction(id);
    const source = parseReceiptSource(tx?.receiptUrl);
    if (!tx || !source) throw new NotFoundException('Giao dịch không có ảnh hoá đơn.');

    let content: Buffer;
    let mimeType: string;
    try {
      if (source.kind === 'drive') {
        const drive = this.moduleRef?.get(GoogleDriveService, { strict: false });
        if (!drive) throw new Error('GoogleDriveService unavailable');
        ({ content, mimeType } = await downloadDriveReceipt(drive, source.fileId, {
          creatorUserId: tx.createdByUserId,
          timeoutMs: RECEIPT_FETCH_TIMEOUT_MS,
        }));
      } else {
        const upstream = await fetch(source.url, {
          signal: AbortSignal.timeout(RECEIPT_FETCH_TIMEOUT_MS),
        });
        if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
        content = Buffer.from(await upstream.arrayBuffer());
        mimeType = upstream.headers.get('content-type') || 'image/jpeg';
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Receipt ${id} unavailable: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      throw new NotFoundException('Không tải được ảnh hoá đơn.');
    }
    if (content.length > RECEIPT_MAX_BYTES) throw new NotFoundException('Ảnh hoá đơn quá lớn.');
    // Never relay non-image content (e.g. an HTML error page) under the API origin.
    if (!mimeType.startsWith('image/')) throw new NotFoundException('Tệp không phải hình ảnh.');

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(content);
  }

  @Get('finance/analytics')
  @ApiOperation({ summary: 'Lấy dữ liệu phân tích báo cáo tài chính trực quan' })
  async getAnalytics(
    @Req() req: Request,
    @Query('startAt') startAt?: string,
    @Query('endAt') endAt?: string,
    @Query('grain') grain?: AnalyticsGrain,
  ) {
    this.authenticate(req);
    const data = await this.finance.getAnalyticsReport(startAt, endAt, grain);
    return { data };
  }

  @Get('transactions')
  @ApiOperation({
    summary: 'Lấy danh sách giao dịch thu/chi theo kỳ, kèm số dư lũy kế và số dư sổ cái',
  })
  async listTransactions(@Req() req: Request, @Query() query: Record<string, unknown>) {
    this.authenticate(req);
    return {
      data: await this.finance.queryTransactions(this.transactionListQuery(query)),
    };
  }

  @Get('transactions/:id')
  async getTransaction(@Req() req: Request, @Param('id') id: string) {
    this.authenticate(req);
    return {
      data: await this.required(this.finance.getTransaction(id)),
    };
  }

  @Post('transactions')
  async createTransaction(@Req() req: Request, @Body() body: RecordBody) {
    this.authenticate(req);
    return {
      data: await this.finance.createTransaction({
        ...this.transactionInput(body),
        createdByUserId: String(this.actorId(req)),
        source: 'dashboard',
      }),
    };
  }

  @Patch('transactions/:id')
  async updateTransaction(@Req() req: Request, @Param('id') id: string, @Body() body: RecordBody) {
    this.authenticate(req);
    return {
      data: await this.required(
        this.finance.updateTransaction(id, this.transactionInput(body, true)),
      ),
    };
  }

  @Delete('transactions/:id')
  async deleteTransaction(@Req() req: Request, @Param('id') id: string) {
    this.authenticate(req);
    if (!(await this.finance.deleteTransaction(id))) throw new NotFoundException();
    return { data: { deleted: true } };
  }

  @Get('transactions/:id/candidate-debts')
  @ApiOperation({ summary: 'Lấy danh sách công nợ ứng viên cho giao dịch' })
  async listCandidateDebts(@Req() req: Request, @Param('id') id: string) {
    this.authenticate(req);
    return { data: await this.finance.listCandidateDebts(id) };
  }

  @Get('transactions/:id/allocations')
  @ApiOperation({ summary: 'Lấy danh sách phân bổ công nợ của giao dịch' })
  async getTransactionAllocations(@Req() req: Request, @Param('id') id: string) {
    this.authenticate(req);
    return { data: await this.finance.getTransactionAllocations(id) };
  }

  @Post('transactions/:id/allocations')
  @ApiOperation({ summary: 'Lưu phân bổ giao dịch vào các khoản công nợ' })
  async allocateTransactionToDebts(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: RecordBody,
  ) {
    this.authenticate(req);
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
      data: await this.finance.allocateTransactionToDebts(id, allocations),
    };
  }

  @Delete('transactions/:id/allocations/:allocationId')
  @ApiOperation({ summary: 'Xóa một phân bổ công nợ của giao dịch' })
  async deleteDebtAllocation(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('allocationId') allocationId: string,
  ) {
    this.authenticate(req);
    if (!(await this.finance.deleteDebtAllocation(id, allocationId))) {
      throw new NotFoundException();
    }
    return { data: { deleted: true } };
  }

  @Get('categories')
  @ApiOperation({ summary: 'Lấy danh sách danh mục thu/chi' })
  async listCategories(@Req() req: Request, @Query('type') type?: 'income' | 'expense') {
    this.authenticate(req);
    const categories = await this.finance.listCategories(type);
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
    this.authenticate(req);
    const type = this.string(body.type, 'type');
    if (type !== 'income' && type !== 'expense') {
      throw new BadRequestException('Loại danh mục phải là income hoặc expense.');
    }
    const name = this.string(body.name, 'name');
    const color = this.optionalString(body.color);
    const icon = this.optionalString(body.icon);
    const cat = await this.finance.createCategory({
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
    this.authenticate(req);
    const name = this.optionalString(body.name);
    const color = this.optionalString(body.color);
    const icon = this.optionalString(body.icon);
    const cat = await this.finance.updateCategory(id, {
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
    this.authenticate(req);
    const deleted = await this.finance.deleteCategory(id);
    if (!deleted) throw new NotFoundException('Không tìm thấy danh mục.');
    return { data: { deleted: true } };
  }

  @Get('places')
  @ApiOperation({ summary: 'Lấy danh sách nơi chốn/cửa hàng' })
  async listPlaces(@Req() req: Request) {
    this.authenticate(req);
    const places = await this.finance.listPlaces();
    return { data: places.map((place) => this.placeResponse(place)) };
  }

  @Post('places')
  @ApiOperation({ summary: 'Tạo nơi chốn/cửa hàng' })
  async createPlace(@Req() req: Request, @Body() body: RecordBody) {
    this.authenticate(req);
    return {
      data: this.placeResponse(await this.finance.createPlace(this.string(body.name, 'name'))),
    };
  }

  @Patch('places/:id')
  @ApiOperation({ summary: 'Cập nhật nơi chốn/cửa hàng' })
  async updatePlace(@Req() req: Request, @Param('id') id: string, @Body() body: RecordBody) {
    this.authenticate(req);
    const place = await this.finance.updatePlace(id, this.string(body.name, 'name'));
    if (!place) throw new NotFoundException('Không tìm thấy nơi chốn.');
    return { data: this.placeResponse(place) };
  }

  @Delete('places/:id')
  @ApiOperation({ summary: 'Xóa nơi chốn/cửa hàng' })
  async deletePlace(@Req() req: Request, @Param('id') id: string) {
    this.authenticate(req);
    if (!(await this.finance.deletePlace(id))) {
      throw new NotFoundException('Không tìm thấy nơi chốn.');
    }
    return { data: { deleted: true } };
  }

  @Post('places/combine')
  @ApiOperation({ summary: 'Gộp nhiều nơi chốn/địa điểm thành một nơi chốn chính' })
  async combinePlaces(@Req() req: Request, @Body() body: RecordBody) {
    this.authenticate(req);
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

    const result = await this.finance.combinePlaces({
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
    this.authenticate(req);
    return { data: await this.required(this.finance.getContact(id)) };
  }

  @Post('contacts')
  async createContact(@Req() req: Request, @Body() body: RecordBody) {
    this.authenticate(req);
    return {
      data: await this.finance.createContact(
        this.string(body.displayName, 'displayName'),
        this.optionalString(body.alias),
        this.optionalString(body.descriptor),
        this.optionalString(body.phoneNumber),
        this.optionalString(body.bankAccountNumber),
        this.optionalString(body.bankCode),
        this.optionalString(body.bankName),
        this.optionalString(body.avatarUrl),
        this.linkedUserId(req, body),
      ),
    };
  }

  @Patch('contacts/:id')
  async updateContact(@Req() req: Request, @Param('id') id: string, @Body() body: RecordBody) {
    this.authenticate(req);
    return {
      data: await this.finance.updateContact(
        id,
        this.string(body.displayName, 'displayName'),
        this.optionalString(body.alias),
        this.optionalString(body.descriptor),
        this.optionalString(body.phoneNumber),
        this.optionalString(body.bankAccountNumber),
        this.optionalString(body.bankCode),
        this.optionalString(body.bankName),
        this.optionalString(body.avatarUrl),
        this.linkedUserId(req, body),
      ),
    };
  }

  @Post('contacts/sync-users')
  @ApiOperation({
    summary: 'Đưa người dùng Zalo vào danh bạ công nợ của admin và đồng bộ SĐT (Admin Only)',
  })
  async syncUsersIntoContacts(@Req() req: Request) {
    this.authenticate(req);
    if (!this.users.isAdmin(this.actorId(req))) throw new ForbiddenException();
    return {
      data: await this.contactUserSync.syncUsersIntoContacts(),
    };
  }

  @Post('contacts/combine')
  @ApiOperation({ summary: 'Gộp nhiều liên hệ thành một liên hệ chính' })
  async combineContacts(@Req() req: Request, @Body() body: RecordBody) {
    this.authenticate(req);
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

    const result = await this.finance.combineContacts({
      targetContactId,
      sourceContactIds: rawSourceContactIds,
      contactIds,
      displayName: this.optionalString(body.displayName),
      alias: this.optionalString(body.alias),
      descriptor: this.optionalString(body.descriptor),
      linkedUserId: this.linkedUserId(req, body),
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
    this.authenticate(req);
    const debtIds = Array.isArray(body.debtIds)
      ? body.debtIds.filter(
          (item): item is string => typeof item === 'string' && Boolean(item.trim()),
        )
      : [];
    if (debtIds.length < 2) {
      throw new BadRequestException('debtIds must contain at least 2 debt IDs to combine.');
    }

    const result = await this.finance.combineDebts({
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
    this.authenticate(req);
    if (!(await this.finance.deleteContact(id))) throw new NotFoundException();
    return { data: { deleted: true } };
  }

  @Get('debts/:id')
  async getDebt(@Req() req: Request, @Param('id') id: string) {
    this.authenticate(req);
    return { data: await this.required(this.finance.getDebt(id)) };
  }

  @Post('debts')
  async createDebt(@Req() req: Request, @Body() body: RecordBody) {
    this.authenticate(req);
    const direction = this.enum(body.direction, ['receivable', 'payable'] as const, 'direction');
    return {
      data: await this.finance.createDebt({
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
    this.authenticate(req);
    return {
      data: await this.required(
        this.finance.updateDebt(id, {
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
    this.authenticate(req);
    return {
      data: await this.finance.getDebtPayments(id),
    };
  }

  @Post('debts/:id/payments')
  @ApiOperation({ summary: 'Ghi nhận một lần thanh toán nợ' })
  async recordPayment(@Req() req: Request, @Param('id') id: string, @Body() body: RecordBody) {
    this.authenticate(req);
    return {
      data: await this.finance.recordDebtPayment(
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
    this.authenticate(req);
    if (!(await this.finance.deleteDebtPayment(id, paymentId))) {
      throw new NotFoundException();
    }
    return { data: { deleted: true } };
  }

  @Delete('debts/:id')
  async deleteDebt(@Req() req: Request, @Param('id') id: string) {
    this.authenticate(req);
    if (!(await this.finance.deleteDebt(id))) throw new NotFoundException();
    return { data: { deleted: true } };
  }

  private transactionListQuery(query: Record<string, unknown>): ITransactionListQuery {
    const date = (value: unknown, name: string): string | undefined => {
      if (value === undefined || value === '') return undefined;
      const iso = typeof value === 'string' ? toOptionalIsoDate(value) : undefined;
      if (!iso) throw new BadRequestException(`${name} must be an ISO date.`);
      return iso;
    };
    const integer = (value: unknown, name: string, min: number): number | undefined => {
      if (value === undefined || value === '') return undefined;
      const parsed = typeof value === 'string' ? Number(value) : Number.NaN;
      if (!Number.isInteger(parsed) || parsed < min)
        throw new BadRequestException(`${name} must be an integer >= ${min}.`);
      return parsed;
    };
    // Repeated params (`?categories=a&categories=b`) arrive as an array, a single one as a string.
    const list = (value: unknown, name: string): string[] | undefined => {
      if (value === undefined || value === '') return undefined;
      const raw = Array.isArray(value) ? value : [value];
      if (!raw.every((item): item is string => typeof item === 'string'))
        throw new BadRequestException(`${name} must be a list of strings.`);
      const items = [...new Set(raw.map((item) => item.trim()).filter(Boolean))];
      if (items.length > TRANSACTION_FILTER_MAX_VALUES)
        throw new BadRequestException(
          `${name} accepts at most ${TRANSACTION_FILTER_MAX_VALUES} values.`,
        );
      return items.length ? items : undefined;
    };
    const startAt = date(query.startAt, 'startAt');
    const endAt = date(query.endAt, 'endAt');
    if (startAt && endAt && startAt > endAt)
      throw new BadRequestException('startAt must be before endAt.');
    const amountMin = integer(query.amountMin, 'amountMin', 0);
    const amountMax = integer(query.amountMax, 'amountMax', 0);
    if (amountMin !== undefined && amountMax !== undefined && amountMin > amountMax)
      throw new BadRequestException('amountMin must not exceed amountMax.');
    return {
      type:
        query.type === undefined || query.type === ''
          ? undefined
          : this.enum(query.type, ['income', 'expense'] as const, 'type'),
      startAt,
      endAt,
      search: typeof query.search === 'string' ? query.search.trim() || undefined : undefined,
      categories: list(query.categories, 'categories'),
      note: typeof query.note === 'string' ? query.note.trim() || undefined : undefined,
      placeIds: list(query.placeIds, 'placeIds'),
      createdByUserIds: list(query.createdByUserIds, 'createdByUserIds'),
      hasReceipt:
        query.hasReceipt === undefined || query.hasReceipt === ''
          ? undefined
          : this.enum(query.hasReceipt, ['true', 'false'] as const, 'hasReceipt') === 'true',
      amountMin,
      amountMax,
      limit: integer(query.limit, 'limit', 1),
      offset: integer(query.offset, 'offset', 0),
    };
  }

  /** The signed-in dashboard user (used for admin checks and "created by"). */
  private actorId(req: Request): string | number {
    return getDashboardUserId(req, this.tokens);
  }
  /** Requires a signed-in dashboard user; finance data itself is shared, never scoped by user. */
  private authenticate(req: Request): void {
    this.actorId(req);
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
  /**
   * Chỉ admin mới được gắn/bỏ gắn Người liên quan với tài khoản User, vì chọn user
   * cần xem danh sách toàn bộ user hệ thống (dữ liệu chỉ dành cho admin).
   */
  private linkedUserId(req: Request, body: RecordBody): string | null | undefined {
    if (body.linkedUserId === undefined) return undefined;
    if (!this.users.isAdmin(this.actorId(req))) {
      throw new ForbiddenException(
        'Chỉ admin mới được liên kết người liên quan với tài khoản User.',
      );
    }
    return body.linkedUserId === null ? null : this.optionalString(body.linkedUserId);
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

import { Controller, Get, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { calendar_v3, tasks_v1 } from 'googleapis';
import { AuditService } from '../audit/audit.service';
import { FinanceService } from '../finance/finance.service';
import { GoogleAuthService } from '../google/google-auth.service';
import { GoogleCalendarService } from '../google/google-calendar.service';
import { GoogleTasksService } from '../google/google-tasks.service';
import { RemindersService } from '../reminders/reminders.service';
import { UsersService } from '../users/users.service';
import { DebtEntity } from '../database/entities/debt.entity';
import { ReportsTokenService } from './reports-token.service';

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

@ApiTags('Reports & Dashboard')
@Controller()
export class ReportsController {
  constructor(
    private readonly config: ConfigService,
    private readonly finance: FinanceService,
    private readonly audit: AuditService,
    private readonly googleAuth: GoogleAuthService,
    private readonly calendar: GoogleCalendarService,
    private readonly tasks: GoogleTasksService,
    private readonly reminders: RemindersService,
    private readonly users: UsersService,
    private readonly tokens: ReportsTokenService,
  ) {}

  @Get('access')
  @ApiOperation({ summary: 'Đổi One-Time Token lấy Dashboard Session Token' })
  public async access(
    @Query('token') token: string,
    @Res() res: Response,
    @Req() req: Request,
  ): Promise<void> {
    let userId: string | number;
    try {
      userId = await this.tokens.consumeExchangeToken(token);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.renderAccessError(res);
        return;
      }
      throw error;
    }
    const access = this.tokens.issueAccessToken(userId);
    const refresh = this.tokens.issueRefreshToken(userId);
    this.setRefreshCookie(res, refresh.token);

    // Ưu tiên redirect về cùng Origin/Host mà user đang truy cập (hỗ trợ Cloudflare Tunnel / Gateway)
    let webOrigin = this.config.getOrThrow<string>('webOrigin').replace(/\/+$/, '');
    const configuredProto = webOrigin.startsWith('https://') ? 'https' : 'http';
    const forwardedHost = req.get('x-forwarded-host') || req.get('host');
    const headerProto = req.get('x-forwarded-proto');
    const forwardedProto = headerProto && headerProto.includes('https') ? 'https' : configuredProto;

    if (
      forwardedHost &&
      !['localhost', '127.0.0.1', '0.0.0.0', 'host.docker.internal'].includes(
        forwardedHost.split(':')[0],
      )
    ) {
      webOrigin = `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '');
    }

    res.redirect(`${webOrigin}/#dashboard_token=${encodeURIComponent(access.token)}`);
  }

  private renderAccessError(res: Response): void {
    res.status(401).type('html').send(`<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Không thể mở Dashboard</title>
  </head>
  <body>
    <main>
      <h1>Không thể mở Dashboard</h1>
      <p>Liên kết này đã hết hạn hoặc đã được sử dụng.</p>
      <p>Vui lòng quay lại Zalo và yêu cầu liên kết mới.</p>
    </main>
  </body>
</html>`);
  }

  @Get('dashboard')
  @ApiBearerAuth('bearer-jwt')
  @ApiOperation({ summary: 'Lấy dữ liệu tổng quan cho Dashboard' })
  public async dashboard(@Req() req: Request) {
    const userId = this.getAccessUserId(req);
    const now = new Date();
    const startAt = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const endAt = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    const googleConnected = this.googleAuth.isAuthorized(userId);
    const calendarPromise = this.getCalendarEvents(googleConnected, userId, now);
    const tasksPromise = this.getTasks(googleConnected, userId);
    const [summary, debts, reminders, activity, calendar, tasks] = await Promise.all([
      this.finance.getSummary(userId, startAt, endAt),
      this.finance.getActiveDebts(userId),
      this.reminders.getUserUpcomingReminders(userId),
      this.audit.listRecent(userId, 10),
      calendarPromise,
      tasksPromise,
    ]);
    const receivable = debts
      .filter((item) => item.direction === 'receivable')
      .reduce((total, item) => total + item.remainingAmount, 0);
    const payable = debts
      .filter((item) => item.direction === 'payable')
      .reduce((total, item) => total + item.remainingAmount, 0);
    const isAdmin = this.users.isAdmin(userId);
    return {
      data: {
        user: { name: userId.toString(), isAdmin, googleConnected },
        finance: {
          income: summary.income,
          expense: summary.expense,
          balance: summary.balance,
          receivable,
          payable,
        },
        transactions: summary.transactions.slice(0, 20).map((item) => ({
          id: item.id,
          type: item.type,
          category: item.category,
          note: item.note,
          amount: item.amount,
          placeId: item.placeId,
          placeName: item.place?.name,
          occurredAt: toIsoDate(item.occurredAt),
          allocations: item.allocations?.map((alloc) => ({
            id: alloc.id,
            amount: alloc.amount,
            debtId: alloc.debtId,
            note: alloc.note,
            counterparty: alloc.debt?.counterparty,
            remainingAmount: alloc.debt?.remainingAmount,
          })),
        })),
        debts: debts.map((item) => this.mapDebt(item)),
        calendar: calendar.map((item) => ({
          id: item.id || item.etag || item.summary || 'event',
          title: item.summary || 'Không có tiêu đề',
          description: item.description || undefined,
          location: item.location || undefined,
          startAt: item.start?.dateTime || item.start?.date || undefined,
          endAt: item.end?.dateTime || item.end?.date || undefined,
        })),
        tasks: tasks.map((item) => ({
          id: item.id || item.title || 'task',
          title: item.title || 'Không có tiêu đề',
          notes: item.notes || undefined,
          dueAt: item.due || undefined,
          status: (item.status as 'needsAction' | 'completed') || 'needsAction',
          updatedAt: item.updated || undefined,
          completedAt: item.completed || undefined,
        })),
        reminders: reminders.slice(0, 10).map((item) => ({
          id: item.id,
          title: item.title,
          remindAt: toIsoDate(item.remindAt),
          notifyType: item.notifyType,
          repeatType: item.repeatType || 'none',
          status: item.status || 'pending',
        })),
        activity: activity.map((item) => ({
          id: item.id,
          action: item.action,
          tableName: item.tableName,
          createdAt: toIsoDate(item.createdAt),
        })),
        admin: isAdmin ? await this.getAdminSummary() : undefined,
      },
    };
  }

  @Get('contacts')
  @ApiBearerAuth('bearer-jwt')
  @ApiOperation({ summary: 'Lấy danh sách danh bạ người dùng' })
  public async contacts(@Req() req: Request) {
    const userId = this.getAccessUserId(req);
    const contacts = await this.finance.listContacts(userId);
    return {
      data: contacts.map((contact) => ({
        id: contact.id,
        displayName: contact.displayName,
        alias: contact.alias,
        descriptor: contact.descriptor,
        createdAt: toIsoDate(contact.createdAt),
      })),
    };
  }

  @Get('debts')
  @ApiBearerAuth('bearer-jwt')
  @ApiOperation({ summary: 'Lấy danh sách các khoản nợ / cho vay' })
  public async debts(@Req() req: Request, @Query('status') status?: 'active' | 'settled') {
    const userId = this.getAccessUserId(req);
    const debts = await this.finance.listDebts(userId, status);
    return {
      data: debts.map((debt) => this.mapDebt(debt)),
    };
  }

  private mapDebt(debt: DebtEntity): Record<string, unknown> {
    return {
      id: debt.id,
      direction: debt.direction,
      counterparty: debt.counterparty,
      counterpartyAlias: debt.counterpartyAlias,
      contactId: debt.contactId,
      parentDebtId: debt.parentDebtId,
      originalAmount: debt.originalAmount,
      remainingAmount: debt.remainingAmount,
      status: debt.status || (debt.remainingAmount === 0 ? 'settled' : 'active'),
      currency: debt.currency,
      note: debt.note || undefined,
      occurredAt: toIsoDate(debt.occurredAt || debt.createdAt),
      dueAt: toOptionalIsoDate(debt.dueAt),
      settledAt: toOptionalIsoDate(debt.settledAt),
      createdAt: toIsoDate(debt.createdAt),
      updatedAt: toOptionalIsoDate(debt.updatedAt),
      childCount: debt.children?.length || 0,
      children: debt.children?.map((child: DebtEntity) => this.mapDebt(child)),
      payments: debt.payments?.map((payment) => ({
        id: payment.id,
        debtId: payment.debtId,
        amount: payment.amount,
        paymentDate: toIsoDate(payment.paymentDate || payment.createdAt),
        note: payment.note || undefined,
        financeTransactionId: payment.financeTransactionId || undefined,
        createdAt: toIsoDate(payment.createdAt),
      })),
    };
  }

  @Get('expenses')
  @ApiBearerAuth('bearer-jwt')
  @ApiOperation({ summary: 'Lấy danh sách các khoản chi tiêu' })
  public async expenses(@Req() req: Request) {
    const userId = this.getAccessUserId(req);
    const expenses = await this.finance.listExpenses(userId);
    return {
      data: expenses.map((expense) => ({
        id: expense.id,
        category: expense.category,
        note: expense.note,
        amount: expense.amount,
        occurredAt: toIsoDate(expense.occurredAt),
      })),
    };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Làm mới Access Token thông qua Refresh Token trong cookie' })
  public refresh(@Req() req: Request, @Res() res: Response): void {
    const refreshToken = this.getCookie(req, 'reports_refresh');
    if (!refreshToken) throw new UnauthorizedException();
    const userId = this.tokens.verifyRefreshToken(refreshToken);
    const nextRefresh = this.tokens.issueRefreshToken(userId);
    const access = this.tokens.issueAccessToken(userId);
    this.setRefreshCookie(res, nextRefresh.token);
    res.json({ data: { accessToken: access.token, expiresAt: access.expiresAt } });
  }

  @Post('logout')
  @ApiOperation({ summary: 'Đăng xuất khỏi Dashboard' })
  public logout(@Res() res: Response): void {
    res.clearCookie('reports_refresh', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    res.status(204).send();
  }

  private async getAdminSummary(): Promise<{ userCount: number; googleConnectedCount: number }> {
    const users = await this.users.getUsers();
    return {
      userCount: users.length,
      googleConnectedCount: users.filter((user) => this.googleAuth.isAuthorized(Number(user.id)))
        .length,
    };
  }

  private async getCalendarEvents(
    googleConnected: boolean,
    userId: number | string,
    now: Date,
  ): Promise<calendar_v3.Schema$Event[]> {
    if (!googleConnected) return [];
    try {
      return await this.calendar.listEvents(
        { timeMax: new Date(now.getTime() + 7 * 86400000).toISOString(), maxResults: 10 },
        userId,
      );
    } catch {
      return [];
    }
  }

  private async getTasks(
    googleConnected: boolean,
    userId: number | string,
  ): Promise<tasks_v1.Schema$Task[]> {
    if (!googleConnected) return [];
    try {
      return await this.tasks.listTasks(
        { maxResults: 50, showCompleted: true, showHidden: true },
        userId,
      );
    } catch {
      return [];
    }
  }

  private getAccessUserId(req: Request): string | number {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException();
    return this.tokens.verifyAccessToken(token);
  }

  private getCookie(req: Request, name: string): string | undefined {
    return req.headers.cookie
      ?.split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${name}=`))
      ?.slice(name.length + 1);
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie('reports_refresh', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}

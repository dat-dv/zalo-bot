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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { getDashboardUserId } from '../dashboard-auth/dashboard-user';
import { ReportsTokenService } from '../reports/reports-token.service';
import {
  REMINDER_LIST_STATUSES,
  REMINDER_TIME_LIMITS,
  type ReminderListStatus,
  type ReminderTargetMode,
  isReminderListStatus,
} from '@zalobot/contracts';
import { ReminderEntity } from '../database/entities/reminder.entity';
import { isReminderTargetMode } from './reminder-target';
import { toReminderTimeItems } from './reminder-times';
import { ReminderTargetService } from './reminder-target.service';
import { RemindersService, reminderTarget } from './reminders.service';

/** `?status=` of the list; absent means `upcoming`, so callers that never send it keep working. */
export function reminderListStatus(value: unknown): ReminderListStatus {
  if (value === undefined || value === '') return 'upcoming';
  if (isReminderListStatus(value)) return value;
  throw new BadRequestException('status is invalid.');
}

@ApiTags('Reminders')
@ApiBearerAuth('bearer-jwt')
@Controller('reminders')
export class RemindersController {
  constructor(
    private readonly reminders: RemindersService,
    private readonly targets: ReminderTargetService,
    private readonly tokens: ReportsTokenService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách lời nhắc sắp tới hoặc đã xong của người dùng' })
  @ApiQuery({ name: 'status', required: false, enum: REMINDER_LIST_STATUSES })
  async list(@Req() req: Request, @Query('status') status?: string) {
    return {
      data: await this.withChatNames(
        await this.reminders.getUserReminders(this.userId(req), reminderListStatus(status)),
      ),
    };
  }

  @Get(':id')
  async get(@Req() req: Request, @Param('id') id: string) {
    const row = await this.required(this.reminders.getUserReminder(this.userId(req), id));
    return { data: (await this.withChatNames([row]))[0] };
  }

  @Post()
  async create(@Req() req: Request, @Body() body: Record<string, unknown>) {
    return {
      data: await this.reminders.createReminder({
        userId: this.userId(req),
        title: this.text(body.title, 'title'),
        // `remindTimes` (a list) or the single `remindAt`; one of them is required.
        remindTimes: this.optionalTimes(body) ?? [this.date(body.remindAt)],
        notifyType: this.notify(body.notifyType),
        repeatType: this.repeat(body.repeatType),
        ...this.target(body),
      }),
    };
  }

  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return {
      data: await this.required(
        this.reminders.updateReminder(this.userId(req), id, {
          title: body.title === undefined ? undefined : this.text(body.title, 'title'),
          remindTimes: this.optionalTimes(body),
          notifyType: body.notifyType === undefined ? undefined : this.notify(body.notifyType),
          repeatType: body.repeatType === undefined ? undefined : this.repeat(body.repeatType),
          ...this.target(body),
        }),
      ),
    };
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    if (!(await this.reminders.deleteReminder(id, this.userId(req)))) throw new NotFoundException();
    return { data: { deleted: true } };
  }

  /** Adds each reminder's chat name (a thread, or the user of a private chat) and its times. */
  private async withChatNames(rows: ReminderEntity[]) {
    const [names, times] = await Promise.all([
      this.targets.chatNames(rows.map((row) => reminderTarget(row).chatId)),
      this.reminders.loadTimes(rows.map((row) => row.id)),
    ]);
    return rows.map((row) => ({
      ...row,
      chatName: names.get(reminderTarget(row).chatId),
      remindTimes: toReminderTimeItems(times.filter((time) => time.reminderId === row.id)),
    }));
  }

  /** `remindTimes` (a list) wins over the single `remindAt`; neither = unchanged. */
  private optionalTimes(body: Record<string, unknown>): Date[] | undefined {
    const value = body.remindTimes;
    if (value === undefined)
      return body.remindAt === undefined ? undefined : [this.date(body.remindAt)];
    if (!Array.isArray(value) || value.length > REMINDER_TIME_LIMITS.MAX_TIMES) {
      throw new BadRequestException('remindTimes is invalid.');
    }
    return value.map((item: unknown) => this.date(item));
  }

  /** Target fields of a create/update body; each is optional. */
  private target(body: Record<string, unknown>) {
    return {
      chatId: body.chatId === undefined ? undefined : this.text(body.chatId, 'chatId'),
      remindUserIds:
        body.remindUserIds === undefined ? undefined : this.userIds(body.remindUserIds),
      remindMode: body.remindMode === undefined ? undefined : this.mode(body.remindMode),
    };
  }
  private userIds(value: unknown): string[] {
    if (!Array.isArray(value)) throw new BadRequestException('remindUserIds is invalid.');
    return value.map((id: unknown) => {
      if (typeof id !== 'string') throw new BadRequestException('remindUserIds is invalid.');
      return id;
    });
  }
  private mode(value: unknown): ReminderTargetMode {
    if (isReminderTargetMode(value)) return value;
    throw new BadRequestException('remindMode is invalid.');
  }

  private userId(req: Request) {
    return getDashboardUserId(req, this.tokens);
  }
  private async required<T>(value: Promise<T | null>): Promise<T> {
    const result = await value;
    if (!result) throw new NotFoundException();
    return result;
  }
  private text(value: unknown, name: string) {
    if (typeof value !== 'string' || !value.trim())
      throw new BadRequestException(`${name} is required.`);
    return value.trim();
  }
  private date(value: unknown) {
    const parsed = new Date(this.text(value, 'remindAt'));
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('remindAt is invalid.');
    return parsed;
  }
  private notify(value: unknown): 'text' | 'call' | undefined {
    if (value === undefined) return undefined;
    if (value === 'text' || value === 'call') return value;
    throw new BadRequestException('notifyType is invalid.');
  }
  private repeat(value: unknown): 'none' | 'daily' | 'weekly' | undefined {
    if (value === undefined) return undefined;
    if (value === 'none' || value === 'daily' || value === 'weekly') return value;
    throw new BadRequestException('repeatType is invalid.');
  }
}

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
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { getDashboardUserId } from '../dashboard-auth/dashboard-user';
import { ReportsTokenService } from '../reports/reports-token.service';
import type { ReminderTargetMode } from '@zalobot/contracts';
import { ReminderEntity } from '../database/entities/reminder.entity';
import { isReminderTargetMode } from './reminder-target';
import { ReminderTargetService } from './reminder-target.service';
import { RemindersService, reminderTarget } from './reminders.service';

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
  @ApiOperation({ summary: 'Lấy danh sách lời nhắc sắp tới của người dùng' })
  async list(@Req() req: Request) {
    return {
      data: await this.withChatNames(
        await this.reminders.getUserUpcomingReminders(this.userId(req)),
      ),
    };
  }

  @Get(':id')
  async get(@Req() req: Request, @Param('id') id: string) {
    return { data: await this.required(this.reminders.getUserReminder(this.userId(req), id)) };
  }

  @Post()
  async create(@Req() req: Request, @Body() body: Record<string, unknown>) {
    return {
      data: await this.reminders.createReminder({
        userId: this.userId(req),
        title: this.text(body.title, 'title'),
        remindAt: this.date(body.remindAt),
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
          remindAt: body.remindAt === undefined ? undefined : this.date(body.remindAt),
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

  /** Adds the name of each reminder's chat (a thread, or the user of a private chat). */
  private async withChatNames(rows: ReminderEntity[]) {
    const names = await this.targets.chatNames(rows.map((row) => reminderTarget(row).chatId));
    return rows.map((row) => ({ ...row, chatName: names.get(reminderTarget(row).chatId) }));
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

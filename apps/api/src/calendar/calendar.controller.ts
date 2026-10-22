import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { getDashboardUserId } from '../dashboard-auth/dashboard-user';
import { ReportsTokenService } from '../reports/reports-token.service';
import { CalendarService } from './calendar.service';
import {
  CreateCalendarEventDto,
  ListCalendarEventsQueryDto,
  UpdateCalendarEventDto,
} from './dto/calendar-event.dto';

// A month grid spans six weeks; this leaves room for the agenda's look-ahead.
const MAX_RANGE_DAYS = 400;

@ApiTags('Calendar')
@ApiBearerAuth('bearer-jwt')
@Controller('calendar/events')
export class CalendarController {
  constructor(
    private readonly calendar: CalendarService,
    private readonly tokens: ReportsTokenService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Sự kiện lịch trong khoảng thời gian (đọc từ DB, nhập thêm từ Google)' })
  async list(@Req() req: Request, @Query() query: ListCalendarEventsQueryDto) {
    const userId = this.userId(req);
    const timeMin = new Date(query.timeMin);
    const timeMax = new Date(query.timeMax);
    if (timeMin >= timeMax) throw new BadRequestException('timeMin must be earlier than timeMax.');
    if (timeMax.getTime() - timeMin.getTime() > MAX_RANGE_DAYS * 86_400_000) {
      throw new BadRequestException(`The range must not exceed ${MAX_RANGE_DAYS} days.`);
    }
    const rows = await this.calendar.listEvents({
      timeMin,
      timeMax,
      query: query.query,
      importForUserId: userId,
    });
    return { data: await this.calendar.toItems(rows, userId) };
  }

  @Get(':id')
  async get(@Req() req: Request, @Param('id') id: string) {
    const userId = this.userId(req);
    return { data: (await this.calendar.toItems([await this.calendar.getEvent(id)], userId))[0] };
  }

  @Post()
  @ApiOperation({ summary: 'Tạo sự kiện (lưu DB, sao chép lên Google nếu đã kết nối)' })
  async create(@Req() req: Request, @Body() body: CreateCalendarEventDto) {
    const userId = this.userId(req);
    const row = await this.calendar.createEvent(
      {
        title: body.summary,
        description: body.description,
        location: body.location,
        startAt: this.date(body.startDateTime, 'startDateTime'),
        endAt: this.date(body.endDateTime, 'endDateTime'),
        allDay: body.allDay,
        timeZone: body.timeZone,
        reminderMinutes: body.reminderMinutes,
      },
      { userId, source: 'dashboard' },
    );
    return { data: (await this.calendar.toItems([row], userId))[0] };
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: UpdateCalendarEventDto) {
    const userId = this.userId(req);
    const row = await this.calendar.updateEvent(
      id,
      {
        title: body.summary,
        // An empty string clears the field; undefined leaves it.
        description: body.description,
        location: body.location,
        startAt: body.startDateTime ? this.date(body.startDateTime, 'startDateTime') : undefined,
        endAt: body.endDateTime ? this.date(body.endDateTime, 'endDateTime') : undefined,
        allDay: body.allDay,
        timeZone: body.timeZone,
        reminderMinutes: body.reminderMinutes,
      },
      userId,
    );
    return { data: (await this.calendar.toItems([row], userId))[0] };
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    await this.calendar.deleteEvent(id, this.userId(req));
    return { data: { deleted: true } };
  }

  @Post(':id/resync')
  @ApiOperation({
    summary: 'Ghi lại bản sao Google (sau lỗi, hoặc chuyển sang tài khoản hiện tại)',
  })
  async resync(@Req() req: Request, @Param('id') id: string) {
    const userId = this.userId(req);
    const row = await this.calendar.resyncEvent(id, userId);
    return { data: (await this.calendar.toItems([row], userId))[0] };
  }

  private userId(req: Request): string {
    return String(getDashboardUserId(req, this.tokens));
  }

  private date(value: string, name: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${name} is invalid.`);
    return date;
  }
}

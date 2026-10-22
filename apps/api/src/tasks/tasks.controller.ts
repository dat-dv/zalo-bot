import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { getDashboardUserId } from '../dashboard-auth/dashboard-user';
import { ReportsTokenService } from '../reports/reports-token.service';
import { parseRemindTimesBody } from '../reminders/reminder-rule.body';
import { CreateTaskDto, ListTasksQueryDto, UpdateTaskDto } from './dto/task.dto';
import { TasksService } from './tasks.service';

@ApiTags('Tasks')
@ApiBearerAuth('bearer-jwt')
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly tokens: ReportsTokenService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Việc cần làm dùng chung (lưu trong zalobot)' })
  async list(@Req() req: Request, @Query() query: ListTasksQueryDto) {
    this.userId(req);
    const rows = await this.tasks.listTasks({
      status: query.status,
      query: query.query,
      limit: query.limit,
    });
    return { data: await this.tasks.toItems(rows) };
  }

  @Get(':id')
  async get(@Req() req: Request, @Param('id') id: string) {
    this.userId(req);
    return { data: (await this.tasks.toItems([await this.tasks.getTask(id)]))[0] };
  }

  @Post()
  @ApiOperation({ summary: 'Tạo việc cần làm' })
  async create(@Req() req: Request, @Body() body: CreateTaskDto) {
    const userId = this.userId(req);
    const row = await this.tasks.createTask(
      {
        title: body.title,
        notes: body.notes,
        dueAt: body.due ? new Date(body.due) : null,
        remindTimes: parseRemindTimesBody(body.remindTimes, body.remindAt),
        remindChatId: body.remindChatId,
        remindUserIds: body.remindUserIds,
        remindMode: body.remindMode,
        nagEveryMinutes: body.nagEveryMinutes,
        nagCount: body.nagCount,
      },
      { userId, source: 'dashboard' },
    );
    return { data: (await this.tasks.toItems([row]))[0] };
  }

  @Patch(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: UpdateTaskDto) {
    const userId = this.userId(req);
    const row = await this.tasks.updateTask(
      id,
      {
        title: body.title,
        // An empty string clears the field; undefined leaves it.
        notes: body.notes,
        dueAt: body.due === undefined ? undefined : body.due ? new Date(body.due) : null,
        status: body.status,
        // `remindAt: ''` (legacy single time) or `remindTimes: []` removes every reminder.
        remindTimes: parseRemindTimesBody(body.remindTimes, body.remindAt),
        remindChatId: body.remindChatId,
        remindUserIds: body.remindUserIds,
        remindMode: body.remindMode,
        nagEveryMinutes: body.nagEveryMinutes,
        nagCount: body.nagCount,
      },
      { userId },
    );
    return { data: (await this.tasks.toItems([row]))[0] };
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    this.userId(req);
    await this.tasks.deleteTask(id);
    return { data: { deleted: true } };
  }

  /** The dashboard user; also rejects requests without a valid dashboard token. */
  private userId(req: Request): string {
    return String(getDashboardUserId(req, this.tokens));
  }
}

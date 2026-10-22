import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { getDashboardUserId } from '../dashboard-auth/dashboard-user';
import { ReportsTokenService } from '../reports/reports-token.service';
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
  @ApiOperation({ summary: 'Việc cần làm (đọc từ DB, nhập thêm từ Google Tasks)' })
  async list(@Req() req: Request, @Query() query: ListTasksQueryDto) {
    const userId = this.userId(req);
    const rows = await this.tasks.listTasks({
      status: query.status,
      query: query.query,
      limit: query.limit,
      importForUserId: userId,
    });
    return { data: await this.tasks.toItems(rows, userId) };
  }

  @Get(':id')
  async get(@Req() req: Request, @Param('id') id: string) {
    const userId = this.userId(req);
    return { data: (await this.tasks.toItems([await this.tasks.getTask(id)], userId))[0] };
  }

  @Post()
  @ApiOperation({ summary: 'Tạo việc (lưu DB, sao chép lên Google Tasks nếu đã kết nối)' })
  async create(@Req() req: Request, @Body() body: CreateTaskDto) {
    const userId = this.userId(req);
    const row = await this.tasks.createTask(
      { title: body.title, notes: body.notes, dueAt: body.due ? new Date(body.due) : null },
      { userId, source: 'dashboard' },
    );
    return { data: (await this.tasks.toItems([row], userId))[0] };
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
      },
      userId,
    );
    return { data: (await this.tasks.toItems([row], userId))[0] };
  }

  @Delete(':id')
  async remove(@Req() req: Request, @Param('id') id: string) {
    await this.tasks.deleteTask(id, this.userId(req));
    return { data: { deleted: true } };
  }

  @Post(':id/resync')
  @ApiOperation({
    summary: 'Ghi lại bản sao Google Tasks (sau lỗi, hoặc chuyển sang tài khoản hiện tại)',
  })
  async resync(@Req() req: Request, @Param('id') id: string) {
    const userId = this.userId(req);
    const row = await this.tasks.resyncTask(id, userId);
    return { data: (await this.tasks.toItems([row], userId))[0] };
  }

  private userId(req: Request): string {
    return String(getDashboardUserId(req, this.tokens));
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { TextToolStrategy, TextToolContext } from '../text-tool.interface';
import { TextToolType } from '../text-tool.enum';
import { ZaloService } from '../../zalo.service';
import { GoogleTasksService } from '../../../google/google-tasks.service';
import { GoogleAuthService } from '../../../google/google-auth.service';

@Injectable()
export class ListTasksToolStrategy implements TextToolStrategy {
  public readonly type = TextToolType.LIST_TASKS;
  private readonly logger = new Logger(ListTasksToolStrategy.name);

  constructor(
    private readonly zaloService: ZaloService,
    private readonly tasksService: GoogleTasksService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}

  public async execute(context: TextToolContext): Promise<void> {
    const isGoogleConnected = this.googleAuthService.isAuthorized(context.senderId);

    if (!isGoogleConnected) {
      await this.zaloService.sendMessage(
        context.chatId,
        '⚠️ Bạn chưa kết nối Google Workspace. Vui lòng gõ /login để liên kết Google Tasks.',
      );
      return;
    }

    const args = (context.toolArgs ?? {}) as {
      showCompleted?: boolean;
      maxResults?: number;
    };

    try {
      const tasks = await this.tasksService.listTasks(
        {
          showCompleted: Boolean(args.showCompleted),
          maxResults: args.maxResults || 20,
        },
        context.senderId,
      );

      if (tasks.length === 0) {
        await this.zaloService.sendMessage(
          context.chatId,
          '📝 Không có việc nào trong danh sách Google Tasks của bạn.',
        );
        return;
      }

      const taskLines = tasks.map((t, idx) => {
        const icon = t.status === 'completed' ? '✅' : '▫️';
        const due = t.due ? ` (Hạn: ${t.due.slice(0, 10)})` : '';
        return `  ${idx + 1}. ${icon} ${t.title || 'Không tên'}${due}`;
      });

      const reply =
        `📝 DANH SÁCH VIỆC CẦN LÀM (GOOGLE TASKS)\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        taskLines.join('\n') +
        `\n\n💡 Nhắn "xong việc <tên việc>" để đánh dấu hoàn thành!`;

      await this.zaloService.sendMessage(context.chatId, reply);
    } catch (err) {
      this.logger.error(`Failed to list tasks: ${(err as Error).message}`);
      await this.zaloService.sendMessage(
        context.chatId,
        `⚠️ Không thể tra cứu danh sách việc: ${(err as Error).message}`,
      );
    }
  }
}

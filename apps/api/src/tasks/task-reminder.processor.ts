import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { AuditContext } from '../audit/audit-context';
import { isFinalFailure, processReminderJob, scheduleReminderScan } from '../queue/reminder-job';
import { throttledErrorLogger } from '../queue/reminder-queue';
import { TASK_REMINDERS_QUEUE } from './task-reminder.queue';
import { TaskReminderSchedulerService } from './task-reminder-scheduler.service';

/** Worker of the task reminder queue; one job at a time so reminders go out in order. */
@Processor(TASK_REMINDERS_QUEUE, { concurrency: 1 })
export class TaskReminderProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(TaskReminderProcessor.name);
  private readonly logConnectionError = throttledErrorLogger(this.logger, 'Task reminder queue');

  constructor(
    private readonly scheduler: TaskReminderSchedulerService,
    @InjectQueue(TASK_REMINDERS_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  public onApplicationBootstrap(): void {
    this.queue.on('error', this.logConnectionError);
    // Not awaited: without Redis the API still starts, and BullMQ reconnects on its own.
    void scheduleReminderScan(this.queue).catch((err: unknown) => {
      this.logger.error(
        `Could not schedule the task reminder scan: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    });
  }

  public process(job: Job<unknown>): Promise<string | undefined> {
    // Jobs act for nobody, even when a dashboard request or chat queued them.
    return AuditContext.runAsSystem(() =>
      processReminderJob(job, {
        scan: () => this.scheduler.scanDueReminders(),
        deliver: (data) => this.scheduler.deliverReminder(data),
      }),
    );
  }

  @OnWorkerEvent('failed')
  public onFailed(job: Job<unknown> | undefined, err: Error): void {
    if (!isFinalFailure(job)) return;
    this.logger.error(`Task reminder job ${job.id ?? job.name} failed for good: ${err.message}`);
  }

  @OnWorkerEvent('error')
  public onError(err: Error): void {
    this.logConnectionError(err);
  }
}

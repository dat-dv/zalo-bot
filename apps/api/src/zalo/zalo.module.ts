import { Module, forwardRef } from '@nestjs/common';
import { ZaloController } from './zalo.controller';
import { ZaloService } from './zalo.service';
import { InputProcessor } from './input-processor.service';
import { ZaloMessageParser } from './zalo-message-parser.service';
import { TextInputService } from './text/text-input.service';
import { TextToolFactory } from './text/text-tool.factory';
import { TransactionConfirmationService } from './transaction-confirmation.service';

// Fast-path / Command Strategies
import { StartToolStrategy } from './text/strategies/start-tool.strategy';
import { HelpToolStrategy } from './text/strategies/help-tool.strategy';
import { EchoToolStrategy } from './text/strategies/echo-tool.strategy';
import { PingToolStrategy } from './text/strategies/ping-tool.strategy';
import { ResetToolStrategy } from './text/strategies/reset-tool.strategy';
import { ConversationToolStrategy } from './text/strategies/conversation-tool.strategy';
import { LoginToolStrategy } from './text/strategies/login-tool.strategy';
import { CodeToolStrategy } from './text/strategies/code-tool.strategy';
import { StatusToolStrategy } from './text/strategies/status-tool.strategy';
import { TodayToolStrategy } from './text/strategies/today-tool.strategy';
import { WeekToolStrategy } from './text/strategies/week-tool.strategy';
import { FinanceQuickToolStrategy } from './text/strategies/finance-quick-tool.strategy';
import { DebtsQuickToolStrategy } from './text/strategies/debts-quick-tool.strategy';
import { TasksQuickToolStrategy } from './text/strategies/tasks-quick-tool.strategy';
import { RemindersQuickToolStrategy } from './text/strategies/reminders-quick-tool.strategy';
import { DashboardToolStrategy } from './text/strategies/dashboard-tool.strategy';
import { InviteToolStrategy } from './text/strategies/invite-tool.strategy';
import { UsersListToolStrategy } from './text/strategies/users-list-tool.strategy';
import { BanToolStrategy } from './text/strategies/ban-tool.strategy';

// AI Tool Calling Strategies
import { ManageDebtToolStrategy } from './text/strategies/manage-debt-tool.strategy';
import { RecordTransactionToolStrategy } from './text/strategies/record-transaction-tool.strategy';
import { SetReminderToolStrategy } from './text/strategies/set-reminder-tool.strategy';
import { GetReportToolStrategy } from './text/strategies/get-report-tool.strategy';
import { CreateCalendarEventToolStrategy } from './text/strategies/create-calendar-event-tool.strategy';
import { ListCalendarEventsToolStrategy } from './text/strategies/list-calendar-events-tool.strategy';
import { DeleteCalendarEventToolStrategy } from './text/strategies/delete-calendar-event-tool.strategy';
import { CreateTaskToolStrategy } from './text/strategies/create-task-tool.strategy';
import { ListTasksToolStrategy } from './text/strategies/list-tasks-tool.strategy';
import { CompleteTaskToolStrategy } from './text/strategies/complete-task-tool.strategy';
import { LoginGoogleToolStrategy } from './text/strategies/login-google-tool.strategy';
import { CreateInviteLinkToolStrategy } from './text/strategies/create-invite-link-tool.strategy';

// Related Domain Modules
import { UsersModule } from '../users/users.module';
import { LlmModule } from '../llm/llm.module';
import { FinanceModule } from '../finance/finance.module';
import { RemindersModule } from '../reminders/reminders.module';
import { GoogleModule } from '../google/google.module';
import { DashboardAuthModule } from '../dashboard-auth/dashboard-auth.module';
import { ReceiptStorageModule } from '../receipt-storage/receipt-storage.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    UsersModule,
    LlmModule,
    FinanceModule,
    forwardRef(() => RemindersModule),
    forwardRef(() => GoogleModule),
    DashboardAuthModule,
    ReceiptStorageModule,
    AuditModule,
  ],
  controllers: [ZaloController],
  providers: [
    ZaloService,
    ZaloMessageParser,
    InputProcessor,
    TextInputService,
    TransactionConfirmationService,
    TextToolFactory,
    StartToolStrategy,
    HelpToolStrategy,
    EchoToolStrategy,
    PingToolStrategy,
    ResetToolStrategy,
    ConversationToolStrategy,
    LoginToolStrategy,
    CodeToolStrategy,
    StatusToolStrategy,
    TodayToolStrategy,
    WeekToolStrategy,
    FinanceQuickToolStrategy,
    DebtsQuickToolStrategy,
    TasksQuickToolStrategy,
    RemindersQuickToolStrategy,
    DashboardToolStrategy,
    InviteToolStrategy,
    UsersListToolStrategy,
    BanToolStrategy,
    ManageDebtToolStrategy,
    RecordTransactionToolStrategy,
    SetReminderToolStrategy,
    GetReportToolStrategy,
    CreateCalendarEventToolStrategy,
    ListCalendarEventsToolStrategy,
    DeleteCalendarEventToolStrategy,
    CreateTaskToolStrategy,
    ListTasksToolStrategy,
    CompleteTaskToolStrategy,
    LoginGoogleToolStrategy,
    CreateInviteLinkToolStrategy,
  ],
  exports: [
    ZaloService,
    ZaloMessageParser,
    InputProcessor,
    TextInputService,
    TransactionConfirmationService,
    TextToolFactory,
  ],
})
export class ZaloModule {}

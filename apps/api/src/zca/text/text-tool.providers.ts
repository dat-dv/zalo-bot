// Chat tool strategies, registered as providers so `TextToolFactory` can inject them.
import { WelcomeToolStrategy } from './strategies/welcome-tool.strategy';
import { HelpToolStrategy } from './strategies/help-tool.strategy';
import { EchoToolStrategy } from './strategies/echo-tool.strategy';
import { PingToolStrategy } from './strategies/ping-tool.strategy';
import { ResetToolStrategy } from './strategies/reset-tool.strategy';
import { ConversationToolStrategy } from './strategies/conversation-tool.strategy';
import { LoginToolStrategy } from './strategies/login-tool.strategy';
import { StatusToolStrategy } from './strategies/status-tool.strategy';
import { TodayToolStrategy } from './strategies/today-tool.strategy';
import { WeekToolStrategy } from './strategies/week-tool.strategy';
import { FinanceQuickToolStrategy } from './strategies/finance-quick-tool.strategy';
import { DebtsQuickToolStrategy } from './strategies/debts-quick-tool.strategy';
import { TasksQuickToolStrategy } from './strategies/tasks-quick-tool.strategy';
import { RemindersQuickToolStrategy } from './strategies/reminders-quick-tool.strategy';
import { DashboardToolStrategy } from './strategies/dashboard-tool.strategy';
import { UsersListToolStrategy } from './strategies/users-list-tool.strategy';
import { BanToolStrategy } from './strategies/ban-tool.strategy';
import { ManageDebtToolStrategy } from './strategies/manage-debt-tool.strategy';
import { RecordTransactionToolStrategy } from './strategies/record-transaction-tool.strategy';
import { SetReminderToolStrategy } from './strategies/set-reminder-tool.strategy';
import { GetReportToolStrategy } from './strategies/get-report-tool.strategy';
import { CreateCalendarEventToolStrategy } from './strategies/create-calendar-event-tool.strategy';
import { ListCalendarEventsToolStrategy } from './strategies/list-calendar-events-tool.strategy';
import { DeleteCalendarEventToolStrategy } from './strategies/delete-calendar-event-tool.strategy';
import { CreateTaskToolStrategy } from './strategies/create-task-tool.strategy';
import { ListTasksToolStrategy } from './strategies/list-tasks-tool.strategy';
import { CompleteTaskToolStrategy } from './strategies/complete-task-tool.strategy';
import { LoginGoogleToolStrategy } from './strategies/login-google-tool.strategy';
import { DeleteTransactionToolStrategy } from './strategies/delete-transaction-tool.strategy';
import { CreatePlaceToolStrategy } from './strategies/create-place-tool.strategy';
import { GetStorageLinksToolStrategy } from './strategies/get-storage-links-tool.strategy';
import { ZaloLoginToolStrategy } from './strategies/zalo-login-tool.strategy';
import { ZaloLogoutToolStrategy } from './strategies/zalo-logout-tool.strategy';
import { ShareDriveToolStrategy } from './strategies/share-drive-tool.strategy';
import { SearchChatHistoryToolStrategy } from './strategies/search-chat-history-tool.strategy';
import { AskClarificationToolStrategy } from './strategies/ask-clarification-tool.strategy';
import { RememberNoteToolStrategy } from './strategies/remember-note-tool.strategy';
import { ForgetMemoryToolStrategy } from './strategies/forget-memory-tool.strategy';

export const TEXT_TOOL_STRATEGY_PROVIDERS = [
  WelcomeToolStrategy,
  HelpToolStrategy,
  EchoToolStrategy,
  PingToolStrategy,
  ResetToolStrategy,
  ConversationToolStrategy,
  LoginToolStrategy,
  StatusToolStrategy,
  TodayToolStrategy,
  WeekToolStrategy,
  FinanceQuickToolStrategy,
  DebtsQuickToolStrategy,
  TasksQuickToolStrategy,
  RemindersQuickToolStrategy,
  DashboardToolStrategy,
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
  DeleteTransactionToolStrategy,
  CreatePlaceToolStrategy,
  GetStorageLinksToolStrategy,
  ZaloLoginToolStrategy,
  ZaloLogoutToolStrategy,
  ShareDriveToolStrategy,
  SearchChatHistoryToolStrategy,
  AskClarificationToolStrategy,
  RememberNoteToolStrategy,
  ForgetMemoryToolStrategy,
];

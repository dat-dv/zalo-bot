import { Injectable } from '@nestjs/common';
import { TextToolType } from './text-tool.enum';
import { TextToolStrategy } from './text-tool.interface';
import { StartToolStrategy } from './strategies/start-tool.strategy';
import { HelpToolStrategy } from './strategies/help-tool.strategy';
import { EchoToolStrategy } from './strategies/echo-tool.strategy';
import { PingToolStrategy } from './strategies/ping-tool.strategy';
import { ResetToolStrategy } from './strategies/reset-tool.strategy';
import { ConversationToolStrategy } from './strategies/conversation-tool.strategy';
import { ManageDebtToolStrategy } from './strategies/manage-debt-tool.strategy';
import { RecordTransactionToolStrategy } from './strategies/record-transaction-tool.strategy';
import { SetReminderToolStrategy } from './strategies/set-reminder-tool.strategy';
import { GetReportToolStrategy } from './strategies/get-report-tool.strategy';
import { LoginToolStrategy } from './strategies/login-tool.strategy';
import { CodeToolStrategy } from './strategies/code-tool.strategy';
import { StatusToolStrategy } from './strategies/status-tool.strategy';
import { TodayToolStrategy } from './strategies/today-tool.strategy';
import { WeekToolStrategy } from './strategies/week-tool.strategy';
import { FinanceQuickToolStrategy } from './strategies/finance-quick-tool.strategy';
import { DebtsQuickToolStrategy } from './strategies/debts-quick-tool.strategy';
import { TasksQuickToolStrategy } from './strategies/tasks-quick-tool.strategy';
import { RemindersQuickToolStrategy } from './strategies/reminders-quick-tool.strategy';
import { DashboardToolStrategy } from './strategies/dashboard-tool.strategy';
import { InviteToolStrategy } from './strategies/invite-tool.strategy';
import { UsersListToolStrategy } from './strategies/users-list-tool.strategy';
import { BanToolStrategy } from './strategies/ban-tool.strategy';
import { CreateCalendarEventToolStrategy } from './strategies/create-calendar-event-tool.strategy';
import { ListCalendarEventsToolStrategy } from './strategies/list-calendar-events-tool.strategy';
import { DeleteCalendarEventToolStrategy } from './strategies/delete-calendar-event-tool.strategy';
import { CreateTaskToolStrategy } from './strategies/create-task-tool.strategy';
import { ListTasksToolStrategy } from './strategies/list-tasks-tool.strategy';
import { CompleteTaskToolStrategy } from './strategies/complete-task-tool.strategy';
import { LoginGoogleToolStrategy } from './strategies/login-google-tool.strategy';
import { CreateInviteLinkToolStrategy } from './strategies/create-invite-link-tool.strategy';

@Injectable()
export class TextToolFactory {
  private readonly strategyMap = new Map<TextToolType, TextToolStrategy>();

  constructor(
    startStrategy: StartToolStrategy,
    helpStrategy: HelpToolStrategy,
    echoStrategy: EchoToolStrategy,
    pingStrategy: PingToolStrategy,
    resetStrategy: ResetToolStrategy,
    conversationStrategy: ConversationToolStrategy,
    manageDebtStrategy: ManageDebtToolStrategy,
    recordTransactionStrategy: RecordTransactionToolStrategy,
    setReminderStrategy: SetReminderToolStrategy,
    getReportStrategy: GetReportToolStrategy,
    loginStrategy: LoginToolStrategy,
    codeStrategy: CodeToolStrategy,
    statusStrategy: StatusToolStrategy,
    todayStrategy: TodayToolStrategy,
    weekStrategy: WeekToolStrategy,
    financeQuickStrategy: FinanceQuickToolStrategy,
    debtsQuickStrategy: DebtsQuickToolStrategy,
    tasksQuickStrategy: TasksQuickToolStrategy,
    remindersQuickStrategy: RemindersQuickToolStrategy,
    dashboardStrategy: DashboardToolStrategy,
    inviteStrategy: InviteToolStrategy,
    usersListStrategy: UsersListToolStrategy,
    banStrategy: BanToolStrategy,
    createCalendarEventStrategy: CreateCalendarEventToolStrategy,
    listCalendarEventsStrategy: ListCalendarEventsToolStrategy,
    deleteCalendarEventStrategy: DeleteCalendarEventToolStrategy,
    createTaskStrategy: CreateTaskToolStrategy,
    listTasksStrategy: ListTasksToolStrategy,
    completeTaskStrategy: CompleteTaskToolStrategy,
    loginGoogleStrategy: LoginGoogleToolStrategy,
    createInviteLinkStrategy: CreateInviteLinkToolStrategy,
  ) {
    this.strategyMap.set(TextToolType.START, startStrategy);
    this.strategyMap.set(TextToolType.HELP, helpStrategy);
    this.strategyMap.set(TextToolType.ECHO, echoStrategy);
    this.strategyMap.set(TextToolType.PING, pingStrategy);
    this.strategyMap.set(TextToolType.RESET, resetStrategy);
    this.strategyMap.set(TextToolType.CONVERSATION, conversationStrategy);
    this.strategyMap.set(TextToolType.MANAGE_DEBT, manageDebtStrategy);
    this.strategyMap.set(TextToolType.RECORD_TRANSACTION, recordTransactionStrategy);
    this.strategyMap.set(TextToolType.SET_REMINDER, setReminderStrategy);
    this.strategyMap.set(TextToolType.GET_REPORT, getReportStrategy);
    this.strategyMap.set(TextToolType.LOGIN, loginStrategy);
    this.strategyMap.set(TextToolType.CODE, codeStrategy);
    this.strategyMap.set(TextToolType.STATUS, statusStrategy);
    this.strategyMap.set(TextToolType.TODAY, todayStrategy);
    this.strategyMap.set(TextToolType.WEEK, weekStrategy);
    this.strategyMap.set(TextToolType.FINANCE, financeQuickStrategy);
    this.strategyMap.set(TextToolType.DEBTS, debtsQuickStrategy);
    this.strategyMap.set(TextToolType.TASKS, tasksQuickStrategy);
    this.strategyMap.set(TextToolType.REMINDERS, remindersQuickStrategy);
    this.strategyMap.set(TextToolType.DASHBOARD, dashboardStrategy);
    this.strategyMap.set(TextToolType.INVITE, inviteStrategy);
    this.strategyMap.set(TextToolType.USERS, usersListStrategy);
    this.strategyMap.set(TextToolType.BAN, banStrategy);
    this.strategyMap.set(TextToolType.CREATE_CALENDAR_EVENT, createCalendarEventStrategy);
    this.strategyMap.set(TextToolType.LIST_CALENDAR_EVENTS, listCalendarEventsStrategy);
    this.strategyMap.set(TextToolType.DELETE_CALENDAR_EVENT, deleteCalendarEventStrategy);
    this.strategyMap.set(TextToolType.CREATE_TASK, createTaskStrategy);
    this.strategyMap.set(TextToolType.LIST_TASKS, listTasksStrategy);
    this.strategyMap.set(TextToolType.COMPLETE_TASK, completeTaskStrategy);
    this.strategyMap.set(TextToolType.LOGIN_GOOGLE, loginGoogleStrategy);
    this.strategyMap.set(TextToolType.CREATE_INVITE_LINK, createInviteLinkStrategy);
  }

  public resolveFastPathToolType(text: string): TextToolType | null {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // 1. /start or invite link
    if (trimmed === '/start' || trimmed.startsWith('/start ') || trimmed.startsWith('invite_')) {
      return TextToolType.START;
    }

    // 2. /help
    if (trimmed === '/help') return TextToolType.HELP;

    // 3. /echo
    if (trimmed.startsWith('/echo')) return TextToolType.ECHO;

    // 4. /ping
    if (trimmed === '/ping') return TextToolType.PING;

    // 5. /reset or /clear
    if (trimmed === '/reset' || trimmed === '/clear') return TextToolType.RESET;

    // 6. /login or /auth
    if (trimmed === '/login' || trimmed === '/auth') return TextToolType.LOGIN;

    // 7. /code or auth code pasted
    if (
      trimmed.startsWith('/code') ||
      trimmed.includes('oauth2callback') ||
      trimmed.includes('code=') ||
      (trimmed.startsWith('4/') && trimmed.length > 25)
    ) {
      return TextToolType.CODE;
    }

    // 8. /status
    if (trimmed === '/status') return TextToolType.STATUS;

    // 9. /today
    if (trimmed === '/today') return TextToolType.TODAY;

    // 10. /week
    if (trimmed === '/week') return TextToolType.WEEK;

    // 11. /finance, /thuchi, /money
    if (trimmed === '/finance' || trimmed === '/thuchi' || trimmed === '/money') {
      return TextToolType.FINANCE;
    }

    // 12. /debts, /debt, /congo
    if (trimmed === '/debts' || trimmed === '/debt' || trimmed === '/congo') {
      return TextToolType.DEBTS;
    }

    // 13. /tasks, /task, /task <content>, /viec
    if (
      trimmed === '/tasks' ||
      trimmed === '/task' ||
      trimmed.startsWith('/task ') ||
      trimmed === '/viec' ||
      trimmed.startsWith('/viec ')
    ) {
      return TextToolType.TASKS;
    }

    // 14. /reminders, /reminder, /nhacnho, /nhac
    if (
      trimmed === '/reminders' ||
      trimmed === '/reminder' ||
      trimmed === '/nhacnho' ||
      trimmed === '/nhac'
    ) {
      return TextToolType.REMINDERS;
    }

    // 15. /dashboard or phrases
    if (
      trimmed === '/dashboard' ||
      lower === 'dashboard' ||
      lower === 'mở dashboard' ||
      lower === 'xem dashboard'
    ) {
      return TextToolType.DASHBOARD;
    }

    // 16. Admin commands: /invite, /users, /ban
    if (trimmed === '/invite') return TextToolType.INVITE;
    if (trimmed === '/users') return TextToolType.USERS;
    if (trimmed.startsWith('/ban')) return TextToolType.BAN;

    return null;
  }

  public resolveToolType(text: string): TextToolType {
    const fastPath = this.resolveFastPathToolType(text);
    if (fastPath) return fastPath;
    return TextToolType.CONVERSATION;
  }

  public getStrategy(type: TextToolType): TextToolStrategy {
    const strategy = this.strategyMap.get(type);
    if (!strategy) {
      throw new Error(`Strategy for tool type "${type}" not registered`);
    }
    return strategy;
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cleanBotMention } from './bot-mention.util';
import { TextToolType } from './text-tool.enum';
import { TextToolStrategy } from './text-tool.interface';
import { WelcomeToolStrategy } from './strategies/welcome-tool.strategy';
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

@Injectable()
export class TextToolFactory {
  private readonly strategyMap = new Map<TextToolType, TextToolStrategy>();

  constructor(
    welcomeStrategy?: WelcomeToolStrategy,
    helpStrategy?: HelpToolStrategy,
    echoStrategy?: EchoToolStrategy,
    pingStrategy?: PingToolStrategy,
    resetStrategy?: ResetToolStrategy,
    conversationStrategy?: ConversationToolStrategy,
    manageDebtStrategy?: ManageDebtToolStrategy,
    recordTransactionStrategy?: RecordTransactionToolStrategy,
    setReminderStrategy?: SetReminderToolStrategy,
    getReportStrategy?: GetReportToolStrategy,
    loginStrategy?: LoginToolStrategy,
    statusStrategy?: StatusToolStrategy,
    todayStrategy?: TodayToolStrategy,
    weekStrategy?: WeekToolStrategy,
    financeQuickStrategy?: FinanceQuickToolStrategy,
    debtsQuickStrategy?: DebtsQuickToolStrategy,
    tasksQuickStrategy?: TasksQuickToolStrategy,
    remindersQuickStrategy?: RemindersQuickToolStrategy,
    dashboardStrategy?: DashboardToolStrategy,
    usersListStrategy?: UsersListToolStrategy,
    banStrategy?: BanToolStrategy,
    createCalendarEventStrategy?: CreateCalendarEventToolStrategy,
    listCalendarEventsStrategy?: ListCalendarEventsToolStrategy,
    deleteCalendarEventStrategy?: DeleteCalendarEventToolStrategy,
    createTaskStrategy?: CreateTaskToolStrategy,
    listTasksStrategy?: ListTasksToolStrategy,
    completeTaskStrategy?: CompleteTaskToolStrategy,
    loginGoogleStrategy?: LoginGoogleToolStrategy,
    deleteTransactionStrategy?: DeleteTransactionToolStrategy,
    createPlaceStrategy?: CreatePlaceToolStrategy,
    getStorageLinksStrategy?: GetStorageLinksToolStrategy,
    zaloLoginStrategy?: ZaloLoginToolStrategy,
    zaloLogoutStrategy?: ZaloLogoutToolStrategy,
    shareDriveStrategy?: ShareDriveToolStrategy,
    private readonly configService?: ConfigService,
    searchChatHistoryStrategy?: SearchChatHistoryToolStrategy,
  ) {
    if (welcomeStrategy) this.strategyMap.set(TextToolType.WELCOME, welcomeStrategy);
    if (helpStrategy) this.strategyMap.set(TextToolType.HELP, helpStrategy);
    if (echoStrategy) this.strategyMap.set(TextToolType.ECHO, echoStrategy);
    if (pingStrategy) this.strategyMap.set(TextToolType.PING, pingStrategy);
    if (resetStrategy) this.strategyMap.set(TextToolType.RESET, resetStrategy);
    if (conversationStrategy) this.strategyMap.set(TextToolType.CONVERSATION, conversationStrategy);
    if (manageDebtStrategy) this.strategyMap.set(TextToolType.MANAGE_DEBT, manageDebtStrategy);
    if (recordTransactionStrategy)
      this.strategyMap.set(TextToolType.RECORD_TRANSACTION, recordTransactionStrategy);
    if (deleteTransactionStrategy)
      this.strategyMap.set(TextToolType.DELETE_TRANSACTION, deleteTransactionStrategy);
    if (setReminderStrategy) this.strategyMap.set(TextToolType.SET_REMINDER, setReminderStrategy);
    if (getReportStrategy) this.strategyMap.set(TextToolType.GET_REPORT, getReportStrategy);
    if (loginStrategy) this.strategyMap.set(TextToolType.LOGIN, loginStrategy);
    if (statusStrategy) this.strategyMap.set(TextToolType.STATUS, statusStrategy);
    if (todayStrategy) this.strategyMap.set(TextToolType.TODAY, todayStrategy);
    if (weekStrategy) this.strategyMap.set(TextToolType.WEEK, weekStrategy);
    if (financeQuickStrategy) this.strategyMap.set(TextToolType.FINANCE, financeQuickStrategy);
    if (debtsQuickStrategy) this.strategyMap.set(TextToolType.DEBTS, debtsQuickStrategy);
    if (tasksQuickStrategy) this.strategyMap.set(TextToolType.TASKS, tasksQuickStrategy);
    if (remindersQuickStrategy)
      this.strategyMap.set(TextToolType.REMINDERS, remindersQuickStrategy);
    if (dashboardStrategy) this.strategyMap.set(TextToolType.DASHBOARD, dashboardStrategy);
    if (usersListStrategy) this.strategyMap.set(TextToolType.USERS, usersListStrategy);
    if (banStrategy) this.strategyMap.set(TextToolType.BAN, banStrategy);
    if (createCalendarEventStrategy)
      this.strategyMap.set(TextToolType.CREATE_CALENDAR_EVENT, createCalendarEventStrategy);
    if (listCalendarEventsStrategy)
      this.strategyMap.set(TextToolType.LIST_CALENDAR_EVENTS, listCalendarEventsStrategy);
    if (deleteCalendarEventStrategy)
      this.strategyMap.set(TextToolType.DELETE_CALENDAR_EVENT, deleteCalendarEventStrategy);
    if (createTaskStrategy) this.strategyMap.set(TextToolType.CREATE_TASK, createTaskStrategy);
    if (listTasksStrategy) this.strategyMap.set(TextToolType.LIST_TASKS, listTasksStrategy);
    if (completeTaskStrategy)
      this.strategyMap.set(TextToolType.COMPLETE_TASK, completeTaskStrategy);
    if (loginGoogleStrategy) this.strategyMap.set(TextToolType.LOGIN_GOOGLE, loginGoogleStrategy);
    if (createPlaceStrategy) this.strategyMap.set(TextToolType.CREATE_PLACE, createPlaceStrategy);
    if (getStorageLinksStrategy)
      this.strategyMap.set(TextToolType.GET_STORAGE_LINKS, getStorageLinksStrategy);
    if (zaloLoginStrategy) this.strategyMap.set(TextToolType.ZALO_LOGIN, zaloLoginStrategy);
    if (zaloLogoutStrategy) this.strategyMap.set(TextToolType.ZALO_LOGOUT, zaloLogoutStrategy);
    if (shareDriveStrategy) this.strategyMap.set(TextToolType.SHARE_DRIVE, shareDriveStrategy);
    if (searchChatHistoryStrategy)
      this.strategyMap.set(TextToolType.SEARCH_CHAT_HISTORY, searchChatHistoryStrategy);
  }

  public resolveFastPathToolType(text: string, customBotName?: string): TextToolType | null {
    const botName =
      customBotName ||
      (typeof this.configService?.get === 'function'
        ? this.configService.get<string>('zalo.botName')
        : undefined) ||
      process.env.BOT_NAME ||
      'Bot';
    const cleaned = cleanBotMention(text, botName);
    const trimmed = cleaned.trim();
    const lower = trimmed.toLowerCase();

    // 1. /gioithieu
    if (
      trimmed === '/gioithieu' ||
      trimmed.startsWith('/gioithieu ') ||
      lower === 'giới thiệu' ||
      lower === 'gioi thieu'
    ) {
      return TextToolType.WELCOME;
    }

    // 2. /help
    if (
      trimmed === '/help' ||
      trimmed.startsWith('/help ') ||
      lower === 'help' ||
      lower === 'trợ giúp' ||
      lower === 'tro giup' ||
      lower === 'hướng dẫn' ||
      lower === 'huong dan'
    ) {
      return TextToolType.HELP;
    }

    // 3. /echo
    if (trimmed.startsWith('/echo')) return TextToolType.ECHO;

    // 4. /ping
    if (trimmed === '/ping' || trimmed.startsWith('/ping ')) return TextToolType.PING;

    // 5. /reset or /clear
    if (
      trimmed === '/reset' ||
      trimmed.startsWith('/reset ') ||
      trimmed === '/clear' ||
      trimmed.startsWith('/clear ')
    ) {
      return TextToolType.RESET;
    }

    // 6. /zalo-login, /zca-login, /zlogin
    if (
      trimmed === '/zalo-login' ||
      trimmed.startsWith('/zalo-login ') ||
      trimmed === '/zca-login' ||
      trimmed.startsWith('/zca-login ') ||
      trimmed === '/zlogin' ||
      trimmed.startsWith('/zlogin ')
    ) {
      return TextToolType.ZALO_LOGIN;
    }

    // 6a. /zalo-logout, /zca-logout, /zlogout
    if (
      trimmed === '/zalo-logout' ||
      trimmed.startsWith('/zalo-logout ') ||
      trimmed === '/zca-logout' ||
      trimmed.startsWith('/zca-logout ') ||
      trimmed === '/zlogout' ||
      trimmed.startsWith('/zlogout ')
    ) {
      return TextToolType.ZALO_LOGOUT;
    }

    // 6b. /login or /auth
    if (
      trimmed === '/login' ||
      trimmed.startsWith('/login ') ||
      trimmed === '/auth' ||
      trimmed.startsWith('/auth ')
    ) {
      return TextToolType.LOGIN;
    }

    // 7. /status, /id, /myid
    const isCallId = ['/status', '/id', '/myid'].some((i) => trimmed.toLowerCase().startsWith(i));
    if (isCallId) {
      return TextToolType.STATUS;
    }

    // 9. /today
    if (trimmed === '/today' || trimmed.startsWith('/today ') || lower === 'hôm nay') {
      return TextToolType.TODAY;
    }

    // 10. /week
    if (trimmed === '/week' || trimmed.startsWith('/week ') || lower === 'tuần này') {
      return TextToolType.WEEK;
    }

    // 11. /finance, /thuchi, /money
    if (
      trimmed === '/finance' ||
      trimmed.startsWith('/finance ') ||
      trimmed === '/thuchi' ||
      trimmed.startsWith('/thuchi ') ||
      trimmed === '/money' ||
      trimmed.startsWith('/money ')
    ) {
      return TextToolType.FINANCE;
    }

    // 12. /debts, /debt, /congo
    if (
      trimmed === '/debts' ||
      trimmed.startsWith('/debts ') ||
      trimmed === '/debt' ||
      trimmed.startsWith('/debt ') ||
      trimmed === '/congo' ||
      trimmed.startsWith('/congo ')
    ) {
      return TextToolType.DEBTS;
    }

    // 13. /tasks, /task, /task <content>, /viec
    if (
      trimmed === '/tasks' ||
      trimmed.startsWith('/tasks ') ||
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
      trimmed.startsWith('/reminders ') ||
      trimmed === '/reminder' ||
      trimmed.startsWith('/reminder ') ||
      trimmed === '/nhacnho' ||
      trimmed.startsWith('/nhacnho ') ||
      trimmed === '/nhac' ||
      trimmed.startsWith('/nhac ')
    ) {
      return TextToolType.REMINDERS;
    }

    // 15. /dashboard or phrases
    if (
      trimmed === '/dashboard' ||
      trimmed.startsWith('/dashboard ') ||
      lower === 'dashboard' ||
      lower.startsWith('dashboard ') ||
      lower === 'mở dashboard' ||
      lower.startsWith('mở dashboard ') ||
      lower === 'xem dashboard' ||
      lower.startsWith('xem dashboard ')
    ) {
      return TextToolType.DASHBOARD;
    }

    // 16. Admin commands: /users, /ban
    if (trimmed === '/users' || trimmed.startsWith('/users ')) return TextToolType.USERS;
    if (trimmed.startsWith('/ban')) return TextToolType.BAN;

    // 17. /drive, /storage, /kho, /folder, /album — xem link kho lưu trữ
    if (
      ['/drive', '/storage', '/kho', '/folder', '/album'].some((command) =>
        trimmed.startsWith(command),
      )
    ) {
      return TextToolType.GET_STORAGE_LINKS;
    }

    // 18. /share, /share-drive, /sharedrive, @bot share <email>
    if (
      trimmed === '/share' ||
      trimmed.startsWith('/share ') ||
      trimmed === '/share-drive' ||
      trimmed.startsWith('/share-drive ') ||
      trimmed === '/sharedrive' ||
      trimmed.startsWith('/sharedrive ') ||
      lower.startsWith('share ')
    ) {
      return TextToolType.SHARE_DRIVE;
    }

    return null;
  }

  public resolveToolType(text: string): TextToolType {
    const fastPath = this.resolveFastPathToolType(text);
    if (fastPath) return fastPath;
    return TextToolType.CONVERSATION;
  }

  public registerStrategy(strategy: TextToolStrategy): void {
    this.strategyMap.set(strategy.type, strategy);
  }

  public getStrategy(type: TextToolType): TextToolStrategy {
    const strategy = this.strategyMap.get(type);
    if (!strategy) {
      throw new Error(`Strategy for tool type "${type}" not registered`);
    }
    return strategy;
  }
}

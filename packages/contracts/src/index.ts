export const API_ROUTES = {
  access: '/api/access',
  accessCode: '/api/access/code',
  sessionMe: '/api/me',
  dashboard: '/api/dashboard',
  dashboardRefresh: '/api/refresh',
  dashboardLogout: '/api/logout',
  categories: '/api/categories',
  places: '/api/places',
  placesCombine: '/api/places/combine',
  contacts: '/api/contacts',
  contactsCombine: '/api/contacts/combine',
  contactsSyncUsers: '/api/contacts/sync-users',
  contactProfile: (id: string) => `/api/contacts/${id}/profile`,
  debts: '/api/debts',
  debtsCombine: '/api/debts/combine',
  debtPayments: (debtId: string) => `/api/debts/${debtId}/payments`,
  debtPaymentDetail: (debtId: string, paymentId: string) =>
    `/api/debts/${debtId}/payments/${paymentId}`,
  expenses: '/api/expenses',
  transactions: '/api/transactions',
  financeAnalytics: '/api/finance/analytics',
  reminders: '/api/reminders',
  users: '/api/users',
  usersSyncZca: '/api/users/sync-zca',
  usersGrantAccess: (id: string) => `/api/users/${id}/grant-access`,
  usersMergePreview: (id: string) => `/api/users/${id}/merge-preview`,
  usersMerge: (id: string) => `/api/users/${id}/merge`,
  usersLinkedContacts: (id: string) => `/api/users/${id}/linked-contacts`,
  calendarEvents: '/api/calendar/events',
  calendarEvent: (id: string) => `/api/calendar/events/${id}`,
  calendarEventResync: (id: string) => `/api/calendar/events/${id}/resync`,
  tasks: '/api/tasks',
  reminderTargetChannels: '/api/reminder-targets/channels',
  reminderTargetMembers: (chatId: string) =>
    `/api/reminder-targets/channels/${encodeURIComponent(chatId)}/members`,
  task: (id: string) => `/api/tasks/${id}`,
  googleAuthCallback: '/api/oauth2callback',
  swaggerDocs: '/api/docs',
  transactionCandidateDebts: (id: string) => `/api/transactions/${id}/candidate-debts`,
  transactionReceipt: (id: string) => `/api/transactions/${id}/receipt`,
  transactionAllocations: (id: string) => `/api/transactions/${id}/allocations`,
  transactionAllocationDetail: (txId: string, allocId: string) =>
    `/api/transactions/${txId}/allocations/${allocId}`,
  zcaStatus: '/api/zca/status',
  zcaQr: '/api/zca/qr',
  zcaLoginQr: '/api/zca/login-qr',
  zcaLogout: '/api/zca/logout',
  zcaThreads: '/api/zca/threads',
  zcaListenedThreads: '/api/zca/listened-threads',
  zcaListenedThreadsToggle: '/api/zca/listened-threads/toggle',
  zcaThreadConfigs: '/api/zca/thread-configs',
  zcaThreadConfig: (threadId: string) => `/api/zca/thread-configs/${threadId}`,
  zcaSyncThreadMedia: (threadId: string) => `/api/zca/threads/${threadId}/sync-media`,
  zcaThreadStorageLinks: (threadId: string) => `/api/zca/threads/${threadId}/storage-links`,
  zcaThreadStorageLink: (threadId: string, linkId: string) =>
    `/api/zca/threads/${threadId}/storage-links/${linkId}`,
  zcaThreadMembers: (threadId: string) => `/api/zca/threads/${threadId}/members`,
  driveFolderLink: '/api/drive/folder-link',
  driveOpen: '/api/drive/open',
  photosAlbumLink: '/api/photos/album-link',
  photosOpen: '/api/photos/open',
  googleStorageAccount: '/api/google/storage-account',
  googleStorageAccountLogin: '/api/google/storage-account/login',
  googleStorageAccountLogout: '/api/google/storage-account/logout',
  auditLogs: '/api/audit-logs',
  auditLog: (id: string) => `/api/audit-logs/${id}`,
} as const;

export const APP_ROUTES = {
  home: '/',
  dashboard: '/dashboard',
  about: '/about',
  privacy: '/privacy',
  terms: '/terms',

  transactions: '/transactions',
  expenses: '/expenses',
  income: '/income',

  debts: '/debts',

  analytics: '/analytics',
  analyticsSpending: '/analytics/spending',
  analyticsCashflow: '/analytics/cashflow',
  analyticsDebts: '/analytics/debts',

  calendar: '/calendar',
  tasks: '/tasks',
  reminders: '/reminders',

  contacts: '/contacts',
  /** Static export has no dynamic segments, so the contact id travels in the query string. */
  contactProfilePage: '/contacts/profile',
  contactProfile: (id: string) => `/contacts/profile?id=${encodeURIComponent(id)}`,
  places: '/places',
  zca: '/zca',
  // Static export has no dynamic segments, so the thread id travels in the query string.
  zcaThreadPage: '/zca/thread',
  zcaThread: (threadId: string) => `/zca/thread?id=${encodeURIComponent(threadId)}`,
  settings: '/settings',
  googleStorage: '/google-storage',
  activity: '/activity',
  // Static export has no dynamic segments, so the activity filters travel in the query string.
  activityFor: (table: AuditTableName, recordId: string) =>
    `/activity?table=${encodeURIComponent(table)}&recordId=${encodeURIComponent(recordId)}`,
} as const;

export const SUPPORTED_LOCALES = ['vi', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'vi';

export function normalizeLocale(value: unknown): SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value)
    ? (value as SupportedLocale)
    : DEFAULT_LOCALE;
}

export function localeTag(locale: SupportedLocale): 'vi-VN' | 'en-US' {
  return locale === 'en' ? 'en-US' : 'vi-VN';
}

type TranslationValues = Record<string, string | number>;
const messages = {
  vi: {
    'users.merge.action': 'Gộp vào…',
    'users.merge.actionTitle': 'Gộp tài khoản trùng này vào một người dùng khác',
    'users.merge.title': 'Gộp tài khoản',
    'users.merge.description':
      'Dấu vết của {source} (người tạo giao dịch, liên kết người liên quan, lời nhắc, kết nối Google) sẽ được chuyển sang người dùng đích, sau đó {source} bị xoá khỏi hệ thống. Dữ liệu tài chính là kho chung nên không cần chuyển.',
    'users.merge.sourceLabel': 'Tài khoản nguồn (sẽ bị xoá)',
    'users.merge.targetLabel': 'Gộp vào người dùng',
    'users.merge.targetPlaceholder': 'Chọn người dùng đích',
    'users.merge.noTargets': 'Không có người dùng nào khác để gộp.',
    'users.merge.previewTitle': 'Dữ liệu sẽ được chuyển',
    'users.merge.previewHint': 'Chọn người dùng đích để xem trước dữ liệu sẽ được chuyển.',
    'users.merge.previewLoading': 'Đang tính toán dữ liệu cần chuyển…',
    'users.merge.previewError': 'Không thể tải bản xem trước. Vui lòng thử lại.',
    'users.merge.previewEmpty': 'Tài khoản nguồn không có dữ liệu nào cần chuyển.',
    'users.merge.table.financeTransactions': 'Giao dịch do tài khoản này ghi',
    'users.merge.table.debtContacts': 'Người liên quan đã liên kết',
    'users.merge.table.reminders': 'Lời nhắc',
    'users.merge.table.googleToken': 'Kết nối Google',
    'users.merge.conflicts':
      'Người dùng đích đã liên kết với một người liên quan, nên {contacts} liên kết của tài khoản nguồn sẽ bị gỡ.',
    'users.merge.googleToken.keepSource': 'Giữ kết nối Google của tài khoản nguồn.',
    'users.merge.googleToken.keepTarget': 'Giữ kết nối Google của người dùng đích.',
    'users.merge.googleToken.none': 'Tài khoản nguồn chưa kết nối Google.',
    'users.merge.botAccountWarning': 'Không thể gộp tài khoản ZCA của chính bot.',
    'users.merge.irreversible': 'Tôi hiểu thao tác này không thể hoàn tác.',
    'users.merge.confirm': 'Gộp tài khoản',
    'users.merge.merging': 'Đang gộp…',
    'users.merge.cancel': 'Hủy',
    'users.merge.close': 'Đóng',
    'users.merge.success': 'Đã gộp {source} vào {target}.',
    'users.merge.sessionNotice':
      'Bạn vừa gộp chính tài khoản đang đăng nhập. Hãy mở lại dashboard từ link mà bot gửi qua Zalo.',
    'users.merge.error': 'Không thể gộp tài khoản. Vui lòng thử lại.',
    'users.linkedContacts.action': '🔗 Xem người liên quan đã gắn',
    'users.linkedContacts.badge': '{count} người liên quan',
    'users.linkedContacts.title': 'Người liên quan đã gắn',
    'users.linkedContacts.description':
      'Các mục trong danh bạ công nợ chung đang được liên kết với tài khoản {name}.',
    'users.linkedContacts.loading': 'Đang tải danh sách…',
    'users.linkedContacts.error': 'Không thể tải danh sách. Vui lòng thử lại.',
    'users.linkedContacts.empty': 'Chưa có người liên quan nào được gắn với tài khoản này.',
    'users.linkedContacts.debts': '{count} khoản nợ',
    'users.linkedContacts.openContacts': 'Mở trang Người liên quan',
    'users.linkedContacts.close': 'Đóng',
    'common.refresh': 'Làm mới',
    'common.retry': 'Thử lại',
    'common.logout': 'Đăng xuất',
    'common.logoutConfirm.title': 'Đăng xuất?',
    'common.logoutConfirm.message':
      'Bạn sẽ cần mở lại link đăng nhập từ Zalo Bot để vào dashboard.',
    'common.loggingOut': 'Đang đăng xuất…',
    'common.close': 'Đóng',
    'common.confirm': 'Xác nhận',
    'common.cancel': 'Hủy',
    'common.language': 'Ngôn ngữ',
    'common.loadingDashboard': 'Đang tải dữ liệu',
    'common.notSet': 'Chưa đặt',
    'common.allCategories': 'Tất cả danh mục',
    'common.hideMoney': 'Ẩn số tiền',
    'common.showMoney': 'Hiện số tiền',
    'common.toggleMoneyVisibility': 'Ẩn/hiện số tiền',
    'common.maskedAmount': '••••••',
    'common.today': 'Hôm nay',
    'common.saving': 'Đang lưu...',
    'nav.home': 'Tổng quan',
    'nav.statistics': 'Phân tích',
    'nav.contacts': 'Người liên quan',
    'nav.places': 'Nơi chốn',
    'nav.debts': 'Vay & cho vay',
    'nav.expenses': 'Chi tiêu',
    'nav.income': 'Thu nhập',
    'nav.transactions': 'Thu chi',
    'nav.analytics': 'Phân tích',
    'nav.calendar': 'Lịch',
    'nav.tasks': 'Việc cần làm',
    'nav.reminders': 'Nhắc nhở',
    'nav.reports': 'Tài chính',
    'nav.settings': 'Cài đặt',
    'nav.zca': 'Zalo & Người dùng',
    'nav.googleStorage': 'Google Drive',
    'zca.logout': 'Đăng xuất ZCA',
    'zca.refreshDirectory': 'Làm mới danh bạ Zalo',
    'zca.logoutConfirm':
      'Bạn có chắc chắn muốn ngắt kết nối và đăng xuất tài khoản Zalo cá nhân (ZCA) này không?',
    'zca.logoutSuccess': 'Đã đăng xuất tài khoản ZCA thành công.',
    'zca.forbidden.title': 'Trang này chỉ dành cho admin',
    'zca.forbidden.body':
      'Tài khoản bạn đang đăng nhập dashboard chưa có quyền admin. Hãy nhờ admin cấp quyền hoặc đăng nhập bằng tài khoản admin.',
    'zca.forbidden.backHome': 'Về trang tổng quan',
    'nav.activity': 'Nhật ký hoạt động',
    'audit.title': 'Nhật ký hoạt động',
    'audit.subtitle': 'Ai đã thêm, sửa hoặc xoá dữ liệu, lúc nào và từ đâu.',
    'audit.filter.tables': 'Dữ liệu',
    'audit.filter.allTables': 'Tất cả dữ liệu',
    'audit.filter.actions': 'Hành động',
    'audit.filter.allActions': 'Mọi hành động',
    'audit.filter.sources': 'Nguồn',
    'audit.filter.allSources': 'Mọi nguồn',
    'audit.filter.actors': 'Người thực hiện',
    'audit.filter.allActors': 'Mọi người',
    'audit.filter.from': 'Từ ngày',
    'audit.filter.to': 'Đến ngày',
    'audit.filter.technical': 'Hiện bản ghi kỹ thuật',
    'audit.filter.technicalHint':
      'Token Google, phiên đăng nhập dashboard và dấu đã gửi của từng lần nhắc.',
    'audit.filter.record': 'Bản ghi {id}',
    'audit.filter.clearRecord': 'Bỏ lọc bản ghi',
    'audit.filter.clearAll': 'Xoá bộ lọc',
    'audit.filter.open': 'Bộ lọc',
    'audit.filter.openCount': 'Bộ lọc · {count}',
    'audit.filter.sheetTitle': 'Lọc nhật ký',
    'audit.filter.done': 'Xong',
    'audit.columns.time': 'Thời điểm',
    'audit.columns.actor': 'Người thực hiện',
    'audit.columns.action': 'Hành động',
    'audit.columns.record': 'Dữ liệu',
    'audit.columns.changes': 'Trường thay đổi',
    'audit.view': 'Xem',
    'audit.viewTitle': 'Xem dữ liệu trước và sau khi thay đổi',
    'audit.action.insert': 'Thêm',
    'audit.action.update': 'Sửa',
    'audit.action.remove': 'Xoá',
    'audit.source.dashboard': 'Dashboard',
    'audit.source.zalo': 'Zalo',
    'audit.source.system': 'Hệ thống',
    'audit.source.legacy': 'Dữ liệu cũ',
    'audit.group.finance': 'Tài chính',
    'audit.group.planning': 'Kế hoạch',
    'audit.group.system': 'Hệ thống',
    'audit.table.finance_transactions': 'Giao dịch thu chi',
    'audit.table.debts': 'Khoản nợ',
    'audit.table.debt_payments': 'Lần trả nợ',
    'audit.table.debt_payment_allocations': 'Phân bổ trả nợ',
    'audit.table.debt_contacts': 'Người liên quan',
    'audit.table.finance_places': 'Nơi chốn',
    'audit.table.user_categories': 'Danh mục',
    'audit.table.tasks': 'Việc cần làm',
    'audit.table.task_reminder_times': 'Lần nhắc việc',
    'audit.table.calendar_events': 'Sự kiện lịch',
    'audit.table.reminders': 'Lời nhắc',
    'audit.table.reminder_times': 'Lần nhắc',
    'audit.table.users': 'Người dùng',
    'audit.table.zca_thread_configs': 'Cấu hình kênh',
    'audit.table.channel_storage_links': 'Nơi lưu trữ của kênh',
    'audit.table.user_tokens': 'Kết nối Google',
    'audit.table.dashboard_exchange_tokens': 'Phiên đăng nhập dashboard',
    'audit.actor.system': 'Hệ thống',
    'audit.actor.unknown': 'Không xác định',
    'audit.actor.unnamed': 'Chưa rõ tên (…{suffix})',
    'audit.channel.direct': 'Chat riêng',
    'audit.channel.group': 'Nhóm {name}',
    'audit.channel.groupUnnamed': 'Nhóm Zalo',
    'audit.bulk': 'Hàng loạt',
    'audit.bulkHint':
      'Thay đổi hàng loạt theo điều kiện: không có mã bản ghi và bản sao dữ liệu trước khi sửa.',
    'audit.legacyHint':
      'Dữ liệu cũ: người hiển thị là người tạo bản ghi, có thể không phải người đã sửa.',
    'audit.moreFields': '+{count}',
    'audit.empty': 'Không có hoạt động nào khớp bộ lọc.',
    'audit.error': 'Không thể tải nhật ký. Vui lòng thử lại.',
    'audit.range': '{from}–{to} / {total}',
    'audit.prev': 'Trang trước',
    'audit.next': 'Trang sau',
    'audit.detail.title': 'Chi tiết thay đổi',
    'audit.detail.field': 'Trường',
    'audit.detail.before': 'Trước',
    'audit.detail.after': 'Sau',
    'audit.detail.value': 'Giá trị',
    'audit.detail.noData': 'Không có dữ liệu chi tiết.',
    'audit.detail.loading': 'Đang tải chi tiết…',
    'audit.detail.error': 'Không thể tải chi tiết. Vui lòng thử lại.',
    'audit.detail.recordId': 'Mã bản ghi',
    'audit.detail.channel': 'Kênh',
    'audit.detail.recordHistory': 'Lịch sử bản ghi này',
    'nav.personalSpace': 'Cá nhân',
    'session.title': 'Đang đăng nhập',
    'session.owner': 'Chủ hệ thống (mã đăng nhập)',
    'session.unknownName': 'Chưa rõ tên',
    'session.roleAdmin': 'Admin',
    'session.roleUser': 'Người dùng',
    'session.copyId': 'Copy ID {id}',
    'session.copied': 'Đã copy',
    'nav.section.overview': 'TỔNG QUAN',
    'nav.section.finance': 'TÀI CHÍNH',
    'nav.section.planning': 'KẾ HOẠCH',
    'nav.section.data': 'DỮ LIỆU',
    'nav.section.system': 'HỆ THỐNG',
    'nav.section.other': 'KHÁC',
    'nav.dark': 'Giao diện tối',
    'nav.light': 'Giao diện sáng',
    'nav.menu': 'Menu điều hướng',
    'nav.openMenu': 'Mở menu điều hướng',
    'nav.closeMenu': 'Đóng menu điều hướng',
    'nav.more': 'Thêm',
    'nav.moreTitle': 'Tất cả mục',
    'pullToRefresh.pull': 'Kéo để làm mới',
    'pullToRefresh.release': 'Thả để làm mới',
    'pullToRefresh.refreshing': 'Đang làm mới…',
    'nav.tab.debts': 'Công nợ',
    'nav.tabBar': 'Điều hướng nhanh',
    'web.language.vi': 'Tiếng Việt',
    'web.language.en': 'English',
    'reminder.header.text': '⏰ Nhắc: {title}',
    'reminder.header.call': '📞 Gọi nhắc: {title}',
    'reminder.done': '✅ Đã xong',
    'reminder.snooze': '⏳ Nhắc lại 15 phút',
    'table.searchPlaceholder': 'Tìm kiếm nhanh...',
    'table.filter.all': 'Tất cả',
    'table.filter.receivable': 'Cho vay',
    'table.filter.payable': 'Đi vay',
    'table.filter.income': 'Thu',
    'table.filter.expense': 'Chi',
    'table.ordinal': 'STT',
    'table.id': 'ID',
    'table.rowsCount': '{count} dòng',
    'table.loadMore': 'Tải thêm',
    'table.loadedOf': 'Đã tải {loaded}/{total} dòng',
    'dashboard.columns.createdBy': 'Người tạo',
    'dashboard.columns.receipt': 'Ảnh',
    'transactions.source.dashboard': 'Dashboard',
    'transactions.source.directChat': 'Chat riêng',
    'transactions.source.group': 'Nhóm {name}',
    'transactions.source.groupUnnamed': 'Nhóm Zalo',
    'transactions.receipt.title': 'Ảnh hoá đơn',
    'transactions.receipt.open': 'Mở ảnh',
    'transactions.receipt.error': 'Không tải được ảnh',
    'transactions.receipt.view': 'Xem ảnh hoá đơn',
    'transactions.receipt.showAll': 'Hiện ảnh hoá đơn',
    'transactions.receipt.hideAll': 'Ẩn ảnh hoá đơn',
    'table.columnFilter.open': 'Lọc theo {column}',
    'table.columnFilter.clear': 'Xoá lọc',
    'table.columnFilter.clearAll': 'Xoá tất cả bộ lọc',
    'table.columnFilter.search': 'Tìm…',
    'table.columnFilter.contains': 'Chứa nội dung…',
    'table.columnFilter.noOptions': 'Không có lựa chọn',
    'table.columnFilter.min': 'Từ',
    'table.columnFilter.max': 'Đến',
    'table.columnFilter.any': 'Tất cả',
    'table.columnFilter.hasReceipt': 'Có ảnh',
    'table.columnFilter.noReceipt': 'Không có ảnh',
    'table.columnFilter.noPlace': 'Không có nơi chốn',
    'table.columnFilter.unknownCreator': 'Không rõ tên (…{suffix})',
    'transactions.details.title': 'Chi tiết giao dịch',
    'transactions.details.createdBy': 'Người tạo',
    'transactions.details.source': 'Nguồn',
    'transactions.details.createdAt': 'Thời điểm tạo',
    'transactions.details.paymentMethod': 'Phương thức',
    'transactions.details.currency': 'Tiền tệ',
    'transactions.details.note': 'Ghi chú',
    'transactions.details.history': 'Xem lịch sử thay đổi',
    'table.total': 'Tổng: {total}',
    'table.columnSettings': 'Cài đặt cột',
    'table.columnVisibility': 'Ẩn/hiện cột',
    'table.showAllColumns': 'Hiện tất cả',
    'table.resetColumns': 'Đặt lại mặc định',
    'table.columnsCount': '{visible}/{total} cột',
    'table.scrollHint': 'Cuộn ngang để xem thêm',
    'table.columnRequired': 'Bắt buộc',
    'table.rowDetails': 'Chi tiết bản ghi',
    'table.columnsHiddenBadge': '{count} ẩn',
    'table.idClickToInspect': 'Nhấn để xem chi tiết ID & câu lệnh cho AI Agent',
    'table.idModal.title': 'Chi tiết định danh bản ghi',
    'table.idModal.subtitle': 'Thông tin định danh CSDL & mẫu câu lệnh thao tác cho AI Agent',
    'table.idModal.tableName': 'Bảng dữ liệu',
    'table.idModal.entityName': 'Thực thể nghiệp vụ',
    'table.idModal.fullId': 'Mã định danh đầy đủ (ID)',
    'table.idModal.copyId': 'Sao chép ID',
    'table.idModal.copied': 'Đã sao chép!',
    'table.idModal.agentPromptTitle': 'Mẫu câu lệnh nhanh cho AI Agent (Zalo Bot)',
    'table.idModal.agentPromptDesc':
      'Sao chép câu lệnh dưới đây và gửi vào bot để yêu cầu AI Agent thao tác chính xác bản ghi này.',
    'table.idModal.promptUpdate': 'Cập nhật bản ghi',
    'table.idModal.promptUpdateTemplate': 'Cập nhật {entity} có ID: {id} thành [nội dung cần sửa]',
    'table.idModal.promptDelete': 'Xóa bản ghi',
    'table.idModal.promptDeleteTemplate': 'Xóa {entity} có ID: {id}',
    'table.idModal.promptDetail': 'Xem chi tiết',
    'table.idModal.promptDetailTemplate': 'Kiểm tra chi tiết {entity} có ID: {id}',
    'table.idModal.copyPrompt': 'Sao chép lệnh',
    'table.idModal.explanation':
      'Mã ID này định danh duy nhất bản ghi trong bảng {table}. Khi bạn cung cấp ID này cho AI Agent, agent sẽ tra cứu trực tiếp hoặc cập nhật bản ghi mà không bị nhầm lẫn.',
    'table.entity.transactions': 'Giao dịch thu–chi (finance_transactions)',
    'table.entity.debts': 'Khoản vay nợ (debts)',
    'table.entity.tasks': 'Việc cần làm (tasks)',
    'table.entity.reminders': 'Lời nhắc nhở (reminders)',
    'table.entity.calendar': 'Sự kiện lịch (calendar_events)',
    'table.entity.contacts': 'Người liên quan / Danh bạ (debt_contacts)',
    'table.entity.places': 'Nơi chốn / Địa điểm (finance_places)',
    'table.entity.categories': 'Danh mục thu chi (categories)',
    'table.entity.budgets': 'Ngân sách (budgets)',
    'table.entity.cashflow': 'Dòng tiền (cashflow)',
    'table.entity.general': 'Bản ghi hệ thống',
    'dashboard.quickStats': 'Tổng quan tài chính',
    'dashboard.welcome': 'Xin chào',
    'dashboard.overviewSubtitle': 'Tài chính, công việc và lịch trình của bạn',
    'dashboard.statisticsSubtitle': 'Tổng quan tháng này',
    'dashboard.attentionItems': 'Cần chú ý',
    'dashboard.thisMonthBalance': 'Chênh lệch thu chi',
    'dashboard.receivableTotal': 'Người khác nợ bạn',
    'dashboard.payableTotal': 'Bạn đang nợ',
    'dashboard.incomeTotal': 'Tổng thu',
    'dashboard.expenseTotal': 'Tổng chi',
    'dashboard.netDebt': 'Chênh lệch vay nợ',
    'dashboard.balance': 'Thu − Chi',
    'dashboard.tasks': 'Việc cần làm',
    'dashboard.reminders': 'Nhắc nhở',
    'dashboard.calendar': 'Lịch sắp tới',
    'dashboard.activity': 'Hoạt động gần đây',
    'dashboard.transactions': 'Thu chi gần đây',
    'dashboard.openDebts': 'Vay & cho vay',
    'dashboard.admin': 'Quản trị',
    'dashboard.usersCount': '{count} người dùng',
    'dashboard.googleConnectedCount': '{count} đã kết nối Google',
    'dashboard.connectGoogleTip': 'Kết nối Google từ bot để xem dữ liệu',
    'dashboard.noTasks': 'Chưa có việc cần làm',
    'dashboard.noReminders': 'Chưa có nhắc nhở',
    'dashboard.noCalendar': 'Chưa có lịch sắp tới',
    'dashboard.noActivity': 'Chưa có hoạt động',
    'dashboard.viewAll': 'Xem tất cả',
    'dashboard.noTransactions': 'Chưa có giao dịch',
    'dashboard.noDebts': 'Không có khoản vay nợ',
    'dashboard.noExpenses': 'Chưa có chi tiêu',
    'dashboard.noContacts': 'Chưa có người liên quan nào',
    'dashboard.columns.transaction': 'Nội dung',
    'dashboard.columns.note': 'Ghi chú',
    'dashboard.columns.amount': 'Số tiền',
    'dashboard.columns.counterparty': 'Người liên quan',
    'dashboard.columns.dueDate': 'Ngày hẹn trả',
    'dashboard.columns.remaining': 'Còn lại',
    'dashboard.columns.original': 'Ban đầu',
    'dashboard.columns.direction': 'Loại',
    'dashboard.columns.category': 'Danh mục',
    'dashboard.columns.place': 'Nơi chốn',
    'dashboard.columns.date': 'Thời gian',
    'dashboard.columns.runningBalance': 'Số dư sau GD',
    'dashboard.columns.name': 'Tên',
    'dashboard.columns.alias': 'Tên gọi',
    'dashboard.columns.descriptor': 'Ghi chú',
    'dashboard.columns.title': 'Nội dung',
    'dashboard.columns.action': 'Hoạt động',
    'dashboard.columns.schedule': 'Thời gian',
    'dashboard.error.title': 'Không mở được trang',
    'dashboard.error.desc':
      'Phiên làm việc đã hết hạn. Nhắn "dashboard" cho bot Zalo để nhận mã đăng nhập mới.',
    'auth.loggedOut.title': 'Đã đăng xuất thành công',
    'auth.loggedOut.desc':
      'Phiên làm việc của bạn đã kết thúc an toàn. Nhắn "dashboard" cho bot Zalo để nhận mã đăng nhập mới.',
    'auth.sessionExpired.title': 'Phiên làm việc đã hết hạn',
    'auth.sessionExpired.desc':
      'Phiên truy cập đã hết hạn hoặc không tìm thấy thông tin đăng nhập. Nhắn "dashboard" cho bot Zalo để nhận mã đăng nhập mới.',
    'auth.openZaloBot': 'Mở Zalo Bot',
    'auth.clearSessionAndRetry': 'Xóa phiên & Thử lại',
    'auth.backToAbout': 'Xem trang giới thiệu',
    'auth.accessCode.title': 'Đăng nhập bằng mã',
    'auth.accessCode.desc':
      'Nhắn "dashboard" cho bot Zalo, rồi nhập mã đăng nhập trong tin trả lời.',
    'auth.accessCode.label': 'Mã đăng nhập',
    'auth.accessCode.placeholder': 'VD: 12345678',
    'auth.accessCode.submit': 'Đăng nhập',
    'auth.accessCode.submitting': 'Đang đăng nhập...',
    'auth.accessCode.rejected': 'Mã không đúng, đã hết hạn hoặc đã được dùng.',
    'auth.accessCode.tooManyAttempts': 'Bạn đã thử quá nhiều lần. Vui lòng đợi 15 phút.',
    'auth.accessCode.failed': 'Chưa đăng nhập được. Vui lòng thử lại.',
    'pwa.update.title': 'Đã có phiên bản mới',
    'pwa.update.reload': 'Tải lại',
    'pwa.offline.banner': 'Đang offline — dữ liệu có thể chưa cập nhật',
    'settings.app.title': 'Ứng dụng trên điện thoại',
    'settings.app.description': 'Cài zalobot lên màn hình chính để mở như một ứng dụng',
    'settings.app.install': 'Cài ứng dụng',
    'settings.app.installed': 'Đã cài',
    'settings.app.iosHint': 'Trên Safari: bấm Chia sẻ, rồi chọn "Thêm vào MH chính".',
    'settings.app.zaloHint':
      'Trình duyệt trong Zalo không cài được. Hãy mở trang này bằng Safari hoặc Chrome.',
    'settings.app.unsupported':
      'Trình duyệt này chưa hỗ trợ cài ứng dụng. Hãy dùng Chrome hoặc Safari.',
    'debts.title': 'Vay & cho vay',
    'debts.subtitle': 'Theo dõi tiền bạn cho mượn và tiền bạn đang vay',
    'expenses.title': 'Chi tiêu',
    'expenses.subtitle': 'Ăn uống, đi lại, mua sắm và các khoản chi khác',
    'contacts.title': 'Người liên quan',
    'contacts.subtitle': 'Những người có giao dịch vay, cho vay hoặc thu chi với bạn',
    'contacts.actions.edit': 'Sửa',
    'contacts.actions.save': 'Lưu',
    'contacts.actions.cancel': 'Hủy',
    'contacts.actions.combine': 'Gộp liên hệ ({count})',
    'contacts.combineModal.title': 'Gộp người liên quan',
    'contacts.combineModal.desc':
      'Tập hợp các người liên quan trùng lặp và chuyển toàn bộ công nợ & giao dịch sang người liên quan chính.',
    'contacts.combineModal.contactsList': 'Tập hợp người liên quan cần gộp',
    'contacts.combineModal.targetLabel': 'Người liên quan chính (Lead)',
    'contacts.combineModal.leadBadge': 'Người liên quan chính (Lead)',
    'contacts.combineModal.linkedUserBadge': 'Tài khoản User',
    'contacts.combineModal.debtsBadge': '{count} nợ',
    'contacts.combineModal.transactionsBadge': '{count} giao dịch',
    'contacts.combineModal.leadHint':
      'Mặc định ưu tiên người đã liên kết với tài khoản User hoặc có nhiều công nợ/giao dịch nhất làm Lead.',
    'contacts.combineModal.resourcesHint':
      'Toàn bộ {debts} khoản nợ và {txs} giao dịch liên quan sẽ được chuyển sang người liên quan chính.',
    'contacts.combineModal.mergedName': 'Tên sau khi gộp',
    'contacts.combineModal.mergedAlias': 'Tên gọi / Biệt danh sau khi gộp',
    'contacts.combineModal.mergedDescriptor': 'Địa chỉ quán / Ghi chú sau khi gộp',
    'contacts.combineModal.linkedUserLabel': 'Liên kết với tài khoản User',
    'contacts.combineModal.warning':
      'Toàn bộ công nợ và giao dịch liên quan sẽ được chuyển sang người liên quan chính. Các liên hệ phụ sẽ bị xóa vĩnh viễn.',
    'contacts.combineModal.confirm': 'Xác nhận gộp',
    'contacts.inlineEdit.saved': 'Đã lưu thay đổi',
    'contacts.syncUsers.action': '👥 Đồng bộ người dùng Zalo',
    'contacts.syncUsers.running': 'Đang đồng bộ…',
    'contacts.syncUsers.result':
      'Đã thêm {created} người liên quan · điền SĐT {phoneFilled} · {suggestions} gợi ý',
    'contacts.syncUsers.error': 'Không thể đồng bộ người dùng Zalo. Vui lòng thử lại.',
    'contacts.syncUsers.suggestionsTitle': 'Gợi ý liên kết (trùng tên)',
    'contacts.syncUsers.suggestionsHint':
      'Các người dùng này trùng tên với một người liên quan chưa liên kết. Kiểm tra đúng người rồi bấm Gắn.',
    'contacts.syncUsers.link': 'Gắn',
    'contacts.syncUsers.linked': 'Đã gắn',
    'contacts.syncUsers.dismiss': 'Đóng gợi ý',
    'contacts.phone.zaloMismatch': 'Zalo: {phone}',
    'contacts.phone.zaloMismatchTitle': 'Số lưu trên tài khoản User khác số của người liên quan',
    'contacts.inlineEdit.noLinkedUser': '— Không liên kết —',
    'contacts.inlineEdit.linkedUserLabel': 'Liên kết với tài khoản User',
    'contacts.combine.success': 'Đã gộp thành công {count} liên hệ',
    'contacts.placeholder.descriptor': 'Nhập địa chỉ quán, ghi chú...',
    'contacts.placeholder.name': 'Tên liên hệ / Quán',
    'contacts.placeholder.alias': 'Tên gọi / Biệt danh',
    'contacts.placeholder.phone': 'Nhập số điện thoại...',
    'contacts.placeholder.bankAccount': 'Nhập số tài khoản...',
    'contacts.placeholder.bankName': 'Tên ngân hàng / Mã (VD: VCB, MB)...',
    'contacts.columns.phone': 'Số điện thoại',
    'contacts.columns.bankAccount': 'Tài khoản ngân hàng',
    'contacts.columns.bankName': 'Ngân hàng',
    'contacts.columns.linkedUser': 'Tài khoản User',
    'contacts.columns.resources': 'Dữ liệu liên quan',
    'contacts.actions.profile': 'Hồ sơ',
    'contacts.actions.select': 'Chọn để gộp',
    'contacts.actions.selected': 'Đã chọn',
    'contacts.profile.title': 'Hồ sơ',
    'contacts.profile.back': 'Người liên quan',
    'contacts.profile.missingId': 'Thiếu mã người liên quan trong đường dẫn.',
    'contacts.profile.notFound':
      'Không tìm thấy người liên quan này. Có thể đã bị xoá hoặc đã gộp vào người khác.',
    'contacts.profile.loadError': 'Không tải được hồ sơ.',
    'contacts.profile.edit': 'Sửa',
    'contacts.profile.save': 'Lưu',
    'contacts.profile.cancel': 'Huỷ',
    'contacts.profile.saved': 'Đã lưu hồ sơ',
    'contacts.profile.saveError': 'Không lưu được hồ sơ. Vui lòng thử lại.',
    'contacts.profile.zaloAccount': 'Tài khoản Zalo',
    'contacts.profile.noZaloAccount': 'Chưa gắn tài khoản Zalo',
    'contacts.profile.openZca': 'Mở Zalo & Người dùng',
    'contacts.profile.role.admin': 'Admin',
    'contacts.profile.access.granted': 'Đã cấp quyền',
    'contacts.profile.access.pending': 'Chờ duyệt',
    'contacts.profile.summary.receivable': 'Đang cho vay còn lại',
    'contacts.profile.summary.payable': 'Đang nợ còn lại',
    'contacts.profile.summary.income': 'Tổng thu',
    'contacts.profile.summary.expense': 'Tổng chi',
    'contacts.profile.summary.openDebts': '{count} khoản đang mở',
    'contacts.profile.summary.transactions': '{count} giao dịch',
    'contacts.profile.section.info': 'Thông tin',
    'contacts.profile.section.debts': 'Khoản nợ',
    'contacts.profile.section.transactions': 'Giao dịch gần đây',
    'contacts.profile.transactionsLimited': '{shown} / {total} giao dịch gần nhất',
    'contacts.profile.transactionsScope':
      'Gồm giao dịch gắn với người này và giao dịch do tài khoản Zalo của họ ghi.',
    'contacts.profile.empty.debts': 'Chưa có khoản nợ nào.',
    'contacts.profile.empty.transactions': 'Chưa có giao dịch nào.',
    'contacts.profile.field.name': 'Tên',
    'contacts.profile.field.alias': 'Biệt danh',
    'contacts.profile.field.descriptor': 'Mô tả',
    'contacts.profile.field.phones': 'Số điện thoại',
    'contacts.profile.field.bankAccounts': 'Tài khoản ngân hàng',
    'contacts.profile.field.birthday': 'Ngày sinh',
    'contacts.profile.field.relationship': 'Quan hệ',
    'contacts.profile.field.address': 'Địa chỉ',
    'contacts.profile.field.workplace': 'Nơi làm việc',
    'contacts.profile.field.notes': 'Ghi chú',
    'contacts.profile.primary': 'Chính',
    'contacts.profile.addPhone': '+ Thêm SĐT',
    'contacts.profile.addBankAccount': '+ Thêm tài khoản',
    'contacts.profile.removeRow': 'Xoá dòng',
    'contacts.profile.placeholder.label': 'Nhãn (VD: Công ty)',
    'contacts.profile.placeholder.phone': 'Số điện thoại',
    'contacts.profile.placeholder.accountNumber': 'Số tài khoản',
    'contacts.profile.placeholder.bankName': 'Ngân hàng',
    'contacts.profile.placeholder.address': 'Địa chỉ nhà, khu vực...',
    'contacts.profile.placeholder.workplace': 'Công ty, trường, nơi làm...',
    'contacts.profile.placeholder.notes': 'Tính cách, thói quen trả nợ, lưu ý khi liên lạc...',
    'contacts.profile.primaryHint':
      'SĐT và tài khoản chính không xoá được ở đây (để trống thì giữ nguyên).',
    'contacts.profile.relationship.none': 'Chưa chọn',
    'contacts.profile.relationship.family': 'Người nhà',
    'contacts.profile.relationship.friend': 'Bạn bè',
    'contacts.profile.relationship.colleague': 'Đồng nghiệp',
    'contacts.profile.relationship.partner': 'Đối tác',
    'contacts.profile.relationship.other': 'Khác',
    'contacts.profile.direction.receivable': 'Cho vay',
    'contacts.profile.direction.payable': 'Đi vay',
    'contacts.profile.type.income': 'Thu',
    'contacts.profile.type.expense': 'Chi',
    'contacts.profile.errors.nameRequired': 'Tên không được để trống.',
    'contacts.profile.errors.text_too_long': 'Nội dung quá dài (tối đa {max} ký tự).',
    'contacts.profile.errors.notes_too_long': 'Ghi chú tối đa {max} ký tự.',
    'contacts.profile.errors.birthday_invalid': 'Ngày sinh không hợp lệ.',
    'contacts.profile.errors.birthday_future': 'Ngày sinh không được ở tương lai.',
    'contacts.profile.errors.relationship_invalid': 'Quan hệ không hợp lệ.',
    'contacts.profile.errors.list_invalid': 'Danh sách không hợp lệ.',
    'contacts.profile.errors.too_many_items': 'Tối đa {max} dòng.',
    'contacts.profile.errors.label_too_long': 'Nhãn tối đa {max} ký tự.',
    'contacts.profile.errors.phone_invalid': 'Số điện thoại phải có {min}–{max} chữ số.',
    'contacts.profile.errors.bank_account_invalid': 'Số tài khoản phải có {min}–{max} chữ số.',
    'zca.profile.view': '👤 Xem hồ sơ',
    'zca.profile.create': '➕ Tạo hồ sơ',
    'zca.profile.createError': 'Không tạo được hồ sơ. Vui lòng thử lại.',
    'places.title': 'Nơi chốn & Địa điểm',
    'places.subtitle': 'Danh sách cửa hàng, quán ăn, bệnh viện và địa điểm thu chi của bạn',
    'places.actions.create': 'Thêm nơi chốn',
    'places.actions.edit': 'Sửa',
    'places.actions.save': 'Lưu',
    'places.actions.cancel': 'Hủy',
    'places.actions.delete': 'Xóa',
    'places.columns.name': 'Tên nơi chốn / Địa điểm',
    'places.placeholder.name': 'Nhập tên nơi chốn...',
    'places.inlineEdit.saved': 'Đã cập nhật nơi chốn',
    'places.create.success': 'Đã tạo nơi chốn thành công',
    'places.delete.confirm':
      'Bạn có chắc chắn muốn xóa nơi chốn này không? Các giao dịch cũ vẫn sẽ được giữ nguyên.',
    'places.delete.success': 'Đã xóa nơi chốn thành công',
    'places.noData': 'Chưa có nơi chốn nào',
    'places.columns.transactionCount': 'Số giao dịch',
    'places.actions.combine': 'Gộp nơi chốn ({count})',
    'places.selectAll': 'Chọn tất cả',
    'places.deselectAll': 'Bỏ chọn',
    'places.selectedCount': 'Đã chọn {count}',
    'places.selectMode': 'Chọn',
    'places.selectModeDone': 'Xong',
    'places.combineModal.title': 'Gộp nơi chốn / Cửa hàng',
    'places.combineModal.desc':
      'Tập hợp các địa điểm trùng lặp và chuyển toàn bộ giao dịch sang một địa điểm chính.',
    'places.combineModal.placesList': 'Tập hợp các nơi chốn cần gộp',
    'places.combineModal.leadBadge': 'Nơi chốn chính (Lead)',
    'places.combineModal.leadHint':
      'Mặc định chọn nơi chốn có nhiều giao dịch nhất làm lead. Bạn có thể chọn địa điểm khác nếu muốn.',
    'places.combineModal.newNameLabel': 'Tên nơi chốn mới sau khi gộp',
    'places.combineModal.transactionsBadge': '{count} giao dịch',
    'places.combineModal.newNameHint': '{transactions} sẽ được cập nhật sang nơi chốn này.',
    'places.combineModal.setLead': 'Chọn {name} làm nơi chốn chính',
    'places.combineModal.topBadge': 'Top',
    'places.combineModal.warning':
      'Toàn bộ giao dịch liên quan đến các nơi chốn cũ sẽ được chuyển sang nơi chốn chính. Các nơi chốn phụ sẽ bị xóa vĩnh viễn.',
    'places.combineModal.confirm': 'Xác nhận gộp',
    'places.combine.success': 'Đã gộp thành công {count} nơi chốn',
    'debts.columns.status': 'Trạng thái',
    'debts.columns.settledAt': 'Ngày tất toán',
    'debts.columns.currency': 'Tiền tệ',
    'debts.status.active': 'Đang mở',
    'debts.status.settled': 'Đã tất toán',
    'debts.filter.statusAll': 'Tất cả trạng thái',
    'debts.filter.allStatus': 'Tất cả trạng thái',
    'debts.filter.statusActive': 'Đang mở',
    'debts.filter.statusSettled': 'Đã tất toán',
    'debts.filter.directionAll': 'Tất cả luồng',
    'debts.filter.allDirections': 'Tất cả luồng',
    'debts.stats.receivable': 'Tổng tiền cho vay (Phải thu)',
    'debts.stats.payable': 'Tổng tiền đi vay (Phải trả)',
    'debts.stats.activeCount': 'Khoản nợ đang mở',
    'debts.stats.settledCount': 'Khoản nợ đã tất toán',
    'debts.history.title': 'Lịch sử trả nợ',
    'debts.history.paidAmount': 'Đã trả',
    'debts.history.paymentDate': 'Ngày trả',
    'expenses.columns.paymentMethod': 'Nguồn tiền',
    'expenses.columns.currency': 'Tiền tệ',
    'expenses.actions.edit': 'Sửa',
    'expenses.actions.save': 'Lưu',
    'expenses.actions.cancel': 'Hủy',
    'expenses.actions.delete': 'Xóa',
    'expenses.inlineEdit.saved': 'Đã cập nhật chi tiêu',
    'expenses.delete.confirm': 'Bạn có chắc chắn muốn xóa khoản chi tiêu này không?',
    'expenses.delete.success': 'Đã xóa khoản chi tiêu',
    'expenses.placeholder.category': 'Nhập danh mục...',
    'expenses.placeholder.note': 'Nhập ghi chú chi tiêu...',
    'expenses.placeholder.amount': 'Nhập số tiền...',
    'expenses.placeholder.paymentMethod': 'Nguồn tiền...',
    'debts.actions.edit': 'Sửa',
    'debts.actions.save': 'Lưu',
    'debts.actions.cancel': 'Hủy',
    'debts.actions.repay': 'Trả nợ',
    'debts.actions.combine': 'Gộp khoản nợ ({count})',
    'debts.combineModal.title': 'Gộp các khoản công nợ',
    'debts.combineModal.desc': 'Gom các khoản nợ đã chọn thành một khoản nợ cha tổng hợp.',
    'debts.combineModal.parentNote': 'Ghi chú khoản nợ gộp',
    'debts.combineModal.parentDueDate': 'Hạn hẹn trả của khoản nợ gộp',
    'debts.combineModal.warning':
      'Các khoản nợ đã chọn sẽ trở thành các khoản con thuộc khoản nợ tổng hợp này. Lịch sử thanh toán được bảo lưu toàn vẹn.',
    'debts.combineModal.mismatchedDirection':
      'Chỉ có thể gộp các khoản nợ cùng chiều (cùng Phải thu hoặc cùng Phải trả).',
    'debts.combineModal.mismatchedCurrency': 'Chỉ có thể gộp các khoản nợ có cùng loại tiền tệ.',
    'debts.combineModal.confirm': 'Xác nhận gộp',
    'debts.combine.success': 'Đã gộp thành công {count} khoản nợ',
    'debts.badge.parent': 'Khoản gộp ({count})',
    'debts.badge.child': 'Khoản con',
    'debts.expandChildren': 'Mở rộng khoản con',
    'debts.collapseChildren': 'Thu gọn khoản con',
    'debts.selectedCount': 'Đã chọn {count}',
    'debts.selectAll': 'Chọn tất cả',
    'debts.deselectAll': 'Bỏ chọn',
    'debts.selectOne': 'Chọn',
    'debts.deselectOne': 'Bỏ chọn',
    'debts.paidPercent': 'Đã trả {percent}%',
    'contacts.combineModal.consolidateDebts':
      'Tự động gộp các khoản nợ cùng chiều thành 1 khoản tổng',
    'debts.inlineEdit.saved': 'Đã cập nhật khoản vay nợ',
    'debts.placeholder.counterparty': 'Nhập hoặc chọn người liên quan...',
    'debts.placeholder.originalAmount': 'Số tiền ban đầu...',
    'debts.placeholder.remainingAmount': 'Số tiền còn lại...',
    'debts.placeholder.note': 'Nhập ghi chú...',
    'debts.placeholder.due': 'Hạn chót...',
    'contacts.selectedCount': 'Đã chọn {count}',
    'contacts.selectAll': 'Chọn tất cả',
    'contacts.deselectAll': 'Bỏ chọn',
    'transactions.title': 'Thu chi',
    'transactions.subtitle': 'Lịch sử dòng tiền và các giao dịch thu chi',
    'transactions.actions.edit': 'Sửa',
    'transactions.actions.save': 'Lưu',
    'transactions.actions.cancel': 'Hủy',
    'transactions.actions.delete': 'Xóa',
    'transactions.actions.allocateDebts': 'Phân bổ công nợ',
    'transactions.delete.confirm': 'Bạn có chắc chắn muốn xóa giao dịch này không?',
    'transactions.delete.success': 'Đã xóa giao dịch',
    'transactions.deleteModal.title': 'Xác nhận xóa giao dịch',
    'transactions.deleteModal.subtitle': 'Vui lòng kiểm tra chi tiết và tác động số dư bên dưới.',
    'transactions.deleteModal.impactExpenseRefund': 'Cộng hoàn lại vào số dư ví: +{amount}',
    'transactions.deleteModal.impactExpenseExplain':
      'Khoản chi này sẽ bị xóa khỏi sổ sách, số dư ví khả dụng sẽ tăng thêm tương ứng.',
    'transactions.deleteModal.impactIncomeDeduct': 'Khấu trừ giảm khỏi số dư ví: -{amount}',
    'transactions.deleteModal.impactIncomeExplain':
      'Khoản thu này sẽ bị hủy khỏi sổ sách, số dư ví khả dụng sẽ giảm đi tương ứng.',
    'transactions.deleteModal.allocationsWarning':
      'Giao dịch đang phân bổ vào {count} khoản nợ. Thao tác xóa sẽ khôi phục lại số nợ chưa trả.',
    'transactions.deleteModal.confirmAction': 'Xác nhận xóa',
    'transactions.inlineEdit.saved': 'Đã cập nhật giao dịch',
    'transactions.placeholder.category': 'Nhập danh mục...',
    'transactions.placeholder.place': 'Nhập nơi chốn hoặc cửa hàng...',
    'transactions.placeholder.note': 'Nhập ghi chú...',
    'transactions.placeholder.amount': 'Nhập số tiền...',
    'transactions.allocation.title': 'Phân bổ giao dịch vào công nợ',
    'transactions.allocation.allocated': 'Đã phân bổ',
    'transactions.allocation.unallocated': 'Chưa phân bổ',
    'transactions.allocation.totalAmount': 'Số tiền giao dịch',
    'transactions.allocation.submit': 'Lưu phân bổ',
    'transactions.allocation.success': 'Đã cập nhật phân bổ công nợ thành công',
    'transactions.allocation.exceededAmount':
      'Tổng tiền phân bổ không được vượt quá số tiền giao dịch',
    'transactions.allocation.exceededDebtRemaining': 'Số tiền phân bổ vượt quá số nợ còn lại',
    'transactions.allocation.noCandidates': 'Không có khoản công nợ phù hợp để phân bổ',
    'transactions.allocation.badgeAllocated': '{count} phân bổ',
    'transactions.allocation.modalSubtitleIncome':
      'Gắn số tiền thu được vào các khoản cho vay đang mở (Phải thu)',
    'transactions.allocation.modalSubtitleExpense':
      'Gắn số tiền đã chi vào các khoản nợ đang mở (Phải trả)',
    'transactions.allocation.cannotChangeTypeWithAllocations':
      'Không thể đổi loại giao dịch khi đang có phân bổ công nợ',
    'transactions.allocation.cannotReduceBelowAllocated':
      'Số tiền giao dịch mới không được nhỏ hơn tổng số tiền đã phân bổ ({amount})',
    'transactions.allocation.noteOptional': 'Ghi chú phân bổ (tùy chọn)',
    'transactions.expandAllocations': 'Mở rộng chi tiết phân bổ',
    'transactions.collapseAllocations': 'Thu gọn chi tiết phân bổ',
    'transactions.badge.allocatedChild': 'Phân bổ',
    'transactions.allocation.viewDebt': 'Xem khoản nợ',
    'transactions.allocation.editAllocations': 'Chỉnh sửa phân bổ',
    'transactions.allocation.candidatesTitle': 'Danh sách công nợ phù hợp ({count})',
    'transactions.allocation.loadingCandidates': 'Đang tải danh sách công nợ...',
    'transactions.allocation.allocateMax': 'Phân bổ tối đa',
    'transactions.allocation.originalAmount': 'Nợ gốc',
    'transactions.allocation.remainingAmount': 'Còn lại',
    'transactions.allocation.amountLabel': 'Số tiền phân bổ (VND)',
    'debts.badge.paymentChild': 'Đợt trả nợ',
    'debts.badge.paymentInstallment': '{count} đợt trả',
    'debts.expandPayments': 'Xem {count} đợt trả nợ',
    'debts.collapsePayments': 'Thu gọn đợt trả nợ',
    'debts.paidProgress': 'Đã trả {amount}',
    'debts.paidProgressWithCount': 'Đã trả {amount} ({count} đợt)',
    'debts.deletePayment.confirm':
      'Bạn có chắc chắn muốn xóa đợt trả nợ này? Số tiền nợ còn lại sẽ được khôi phục.',
    'debts.deletePayment.success': 'Đã xóa đợt trả nợ thành công',
    'debts.payments.linkedTransaction': 'Giao dịch liên kết',
    'debts.actions.create': 'Thêm khoản nợ',
    'debts.actions.delete': 'Xóa',
    'debts.create.title': 'Thêm khoản vay nợ',
    'debts.create.description': 'Ghi một khoản cho vay hoặc đi vay vào sổ chung.',
    'debts.create.occurredAt': 'Ngày phát sinh',
    'debts.create.alias': 'Biệt danh (để phân biệt người trùng tên)',
    'debts.create.matchedContact': 'Đã chọn người trong danh bạ: {name}',
    'debts.create.newContact': 'Tạo người liên quan mới «{name}»',
    'debts.create.newContactRequired':
      'Không có ai tên này trong danh bạ. Chọn từ gợi ý hoặc xác nhận tạo người mới.',
    'debts.create.amountInvalid': 'Số tiền phải lớn hơn 0.',
    'debts.create.submit': 'Lưu khoản nợ',
    'debts.create.success': 'Đã thêm khoản vay nợ',
    'debts.create.error': 'Không thể thêm khoản nợ. Vui lòng thử lại.',
    'debts.delete.title': 'Xóa khoản nợ?',
    'debts.delete.message': 'Khoản nợ với {name} ({amount}) sẽ bị xóa vĩnh viễn khỏi sổ chung.',
    'debts.delete.paymentsWarning':
      '{count} đợt trả nợ và các phân bổ giao dịch đi kèm cũng bị xóa; các giao dịch thu/chi đã ghi cho những đợt trả này vẫn giữ trong sổ.',
    'debts.delete.childrenWarning':
      '{count} khoản con đã gộp sẽ được tách ra và hiện lại thành khoản nợ riêng.',
    'debts.delete.success': 'Đã xóa khoản nợ',
    'debts.delete.error': 'Không thể xóa khoản nợ. Vui lòng thử lại.',
    'category.debtRecovery': 'Thu hồi công nợ',
    'category.debtPayment': 'Trả công nợ',
    'category.balanceAdjustment': 'Điều chỉnh số dư',
    'transactions.balanceAdjust.title': 'Cân chỉnh số dư ví',
    'transactions.balanceAdjust.subtitle':
      'Nhập số dư thực tế để hệ thống tự động ghi nhận giao dịch bù trừ cho khớp',
    'transactions.balanceAdjust.currentBalance': 'Số dư trên sổ hiện tại',
    'transactions.balanceAdjust.targetBalance': 'Số dư thực tế mới',
    'transactions.balanceAdjust.targetPlaceholder': 'Nhập số dư thực tế...',
    'transactions.balanceAdjust.difference': 'Chênh lệch bù trừ',
    'transactions.balanceAdjust.diffIncrease': 'Tăng thêm (+{amount}) · Ghi nhận Thu',
    'transactions.balanceAdjust.diffDecrease': 'Giảm bớt (-{amount}) · Ghi nhận Chi',
    'transactions.balanceAdjust.diffZero': 'Số dư thực tế trùng khớp với số dư trên sổ (0 ₫)',
    'transactions.balanceAdjust.note': 'Ghi chú điều chỉnh',
    'transactions.balanceAdjust.defaultNote': 'Cân chỉnh số dư ví: {current} ➔ {target}',
    'transactions.balanceAdjust.date': 'Ngày giờ áp dụng',
    'transactions.balanceAdjust.submit': 'Xác nhận cân chỉnh',
    'transactions.balanceAdjust.success': 'Đã cân chỉnh số dư ví thành công',
    'transactions.balanceAdjust.actionButton': 'Cân chỉnh số dư',
    'transactions.balanceAdjust.invalidAmount': 'Vui lòng nhập số dư thực tế hợp lệ',
    'analytics.title': 'Báo cáo & Phân tích',
    'analytics.subtitle': 'Trực quan hóa xu hướng dòng tiền, cơ cấu chi tiêu và công nợ',
    'analytics.kpi.netSavings': 'Tiết kiệm ròng',
    'analytics.kpi.savingsRate': 'Tỷ lệ tích lũy',
    'analytics.periodResults.title': 'Kết quả trong kỳ',
    'analytics.currentPosition.title': 'Tình hình tài chính hiện tại',
    'analytics.currentPosition.cashflowBalance': 'Số dư dòng tiền theo sổ',
    'analytics.currentPosition.receivable': 'Phải thu còn lại',
    'analytics.currentPosition.payable': 'Phải trả còn lại',
    'analytics.currentPosition.netWorth': 'Tài sản ròng',
    'analytics.chart.cashflowTrend': 'Xu hướng dòng tiền',
    'analytics.chart.spendingDistribution': 'Cơ cấu chi tiêu',
    'analytics.chart.debtBreakdown': 'Cơ cấu công nợ',
    'analytics.chart.netBalance': 'Số dư ròng',
    'analytics.chart.walletBalance': 'Biến động số dư ví',
    'analytics.chart.netCashflow': 'Dòng tiền kỳ',
    'analytics.chart.receivables': 'Phải thu (Cho vay)',
    'analytics.chart.payables': 'Phải trả (Đi vay)',
    'analytics.emptyChartData': 'Không có dữ liệu trong khoảng thời gian này',
    'analytics.topCategories': 'Top danh mục chi tiêu',
    'analytics.topDebtors': 'Top người vay / nợ',
    'analytics.drilldownTitle': 'Chi tiết giao dịch & công nợ trong kỳ',
    'analytics.tab.allCharts': 'Tổng quan biểu đồ',
    'analytics.tab.cashflow': 'Xu hướng dòng tiền',
    'analytics.tab.spending': 'Cơ cấu chi tiêu',
    'analytics.tab.debts': 'Cơ cấu công nợ',
    'analytics.tab.records': 'Dữ liệu chi tiết',
    'analytics.cashflow.breakdownTitle': 'Bảng tổng hợp dòng tiền theo kỳ',
    'analytics.cashflow.avgDailyExpense': 'Chi tiêu TB / ngày',
    'analytics.cashflow.avgDailyIncome': 'Thu nhập TB / ngày',
    'analytics.cashflow.totalPeriod': 'Tổng trong kỳ',
    'analytics.cashflow.column.period': 'Kỳ / Mốc thời gian',
    'analytics.cashflow.column.income': 'Tổng thu (+)',
    'analytics.cashflow.column.expense': 'Tổng chi (-)',
    'analytics.cashflow.column.netCashflow': 'Chênh lệch Thu–Chi',
    'analytics.cashflow.column.balance': 'Số dư ví cuối kỳ',
    'calendar.title': 'Lịch',
    'calendar.subtitle': 'Lịch chung, lưu trong zalobot và sao chép lên Google',
    'calendar.columns.description': 'Mô tả',
    'calendar.columns.location': 'Địa điểm',
    'calendar.columns.endAt': 'Kết thúc',
    'calendar.columns.sync': 'Google Calendar',
    'calendar.actions.edit': 'Sửa',
    'calendar.actions.save': 'Lưu',
    'calendar.actions.cancel': 'Hủy',
    'calendar.actions.delete': 'Xóa',
    'calendar.inlineEdit.saved': 'Đã cập nhật sự kiện',
    'calendar.delete.confirm': 'Bạn có chắc chắn muốn xóa sự kiện này không?',
    'calendar.delete.success': 'Đã xóa sự kiện',
    'calendar.placeholder.title': 'Nhập tiêu đề sự kiện...',
    'calendar.placeholder.location': 'Nhập địa điểm...',
    'calendar.placeholder.description': 'Nhập mô tả chi tiết...',
    'calendar.view.grid': 'Lưới tháng',
    'calendar.view.table': 'Danh sách',
    'calendar.view.agenda': 'Lịch trình',
    'calendar.agenda.prevWeek': 'Tuần trước',
    'calendar.agenda.nextWeek': 'Tuần sau',
    'calendar.allDay': 'Cả ngày',
    'calendar.nav.today': 'Hôm nay',
    'calendar.nav.prev': 'Tháng trước',
    'calendar.nav.next': 'Tháng sau',
    'calendar.day.mon': 'T2',
    'calendar.day.tue': 'T3',
    'calendar.day.wed': 'T4',
    'calendar.day.thu': 'T5',
    'calendar.day.fri': 'T6',
    'calendar.day.sat': 'T7',
    'calendar.day.sun': 'CN',
    'calendar.moreEvents': '+{count} sự kiện',
    'calendar.selectedDayEvents': 'Sự kiện ngày {date}',
    'calendar.noEventsOnDay': 'Không có sự kiện nào trong ngày này',
    'calendar.quickCreate': 'Tạo nhanh sự kiện',
    'calendar.add': 'Thêm sự kiện',
    'calendar.create.title': 'Sự kiện mới',
    'calendar.create.success': 'Đã thêm sự kiện',
    'calendar.edit.title': 'Sửa sự kiện',
    'calendar.details.title': 'Chi tiết sự kiện',
    'calendar.details.created': 'Tạo lúc {date}',
    'calendar.details.when': 'Thời gian',
    'calendar.details.origin': 'Nguồn',
    'calendar.delete.title': 'Xoá sự kiện?',
    'calendar.delete.message':
      'Sự kiện bị xoá khỏi zalobot và khỏi Google Calendar nếu tài khoản giữ bản sao vẫn còn kết nối.',
    'calendar.upcoming': 'Sắp tới · 14 ngày',
    'calendar.upcoming.empty': 'Chưa có sự kiện nào trong 14 ngày tới',
    'calendar.dayEmpty': 'Không có sự kiện',
    'calendar.tomorrow': 'Ngày mai',
    'calendar.summary.today': 'Hôm nay',
    'calendar.summary.next7': '7 ngày tới',
    'calendar.summary.month': 'Trong tháng',
    'calendar.summary.unsynced': 'Chưa lên Google',
    'calendar.filter.unsyncedOnly': 'Đang lọc sự kiện chưa lên Google',
    'calendar.filter.clear': 'Bỏ lọc',
    'calendar.search.open': 'Tìm sự kiện',
    'calendar.localOnlyTip':
      'Chưa kết nối Google: sự kiện vẫn lưu trong zalobot, chỉ chưa có nhắc trên Google Calendar.',
    'calendar.status.ongoing': 'Đang diễn ra',
    'calendar.status.past': 'Đã qua',
    'calendar.duration.minutes': '{count} phút',
    'calendar.duration.hours': '{count} giờ',
    'calendar.duration.hoursMinutes': '{hours} giờ {minutes} phút',
    'calendar.duration.days': '{count} ngày',
    'calendar.sync.synced': 'Đã lên Google',
    'calendar.sync.pending': 'Đang đồng bộ',
    'calendar.sync.failed': 'Lỗi đồng bộ Google',
    'calendar.sync.local': 'Chỉ lưu trong app',
    'calendar.sync.otherAccount': 'Ở tài khoản Google cũ',
    'calendar.sync.account': 'Bản sao Google: {email}',
    'calendar.sync.resync': 'Đồng bộ lại',
    'calendar.sync.resynced': 'Đã đồng bộ lên Google',
    'calendar.source.zalo': 'Tạo từ Zalo',
    'calendar.source.dashboard': 'Tạo từ dashboard',
    'calendar.source.google': 'Tạo trên Google Calendar',
    'calendar.meta.createdBy': 'Tạo bởi {name}',
    'calendar.meta.inChat': 'trong {chat}',
    'calendar.reminders.label': 'Nhắc',
    'calendar.reminders.none': 'Không nhắc',
    'calendar.reminders.atStart': 'Lúc bắt đầu',
    'calendar.reminders.minutes': '{count} phút trước',
    'calendar.reminders.hours': '{count} giờ trước',
    'calendar.reminders.days': '{count} ngày trước',
    'calendar.form.title': 'Tiêu đề',
    'calendar.form.allDay': 'Cả ngày',
    'calendar.form.start': 'Bắt đầu',
    'calendar.form.end': 'Kết thúc',
    'calendar.form.location': 'Địa điểm',
    'calendar.form.description': 'Mô tả',
    'calendar.form.invalidRange': 'Thời điểm kết thúc phải sau lúc bắt đầu',
    'tasks.title': 'Việc cần làm',
    'tasks.subtitle': 'Việc cần làm dùng chung của cả hệ thống, lưu trong zalobot',
    'tasks.columns.status': 'Trạng thái',
    'tasks.columns.notes': 'Ghi chú',
    'tasks.columns.updatedAt': 'Cập nhật',
    'tasks.status.needsAction': 'Cần làm',
    'tasks.status.completed': 'Đã xong',
    'tasks.placeholder.title': 'Nhập tiêu đề công việc...',
    'tasks.placeholder.notes': 'Nhập ghi chú...',
    'tasks.placeholder.due': 'Hạn chót...',
    'tasks.actions.edit': 'Sửa',
    'tasks.actions.save': 'Lưu',
    'tasks.actions.cancel': 'Hủy',
    'tasks.actions.delete': 'Xóa',
    'tasks.actions.complete': 'Hoàn thành',
    'tasks.inlineEdit.saved': 'Đã cập nhật công việc',
    'tasks.inlineEdit.error': 'Không thể lưu công việc. Vui lòng thử lại.',
    'tasks.delete.success': 'Đã xóa công việc',
    'tasks.filter.all': 'Tất cả',
    'tasks.filter.needsAction': 'Cần làm',
    'tasks.filter.completed': 'Đã xong',
    'tasks.stats.total': 'Tổng số việc',
    'tasks.stats.pending': 'Cần làm',
    'tasks.stats.completed': 'Đã xong',
    'tasks.stats.overdue': 'Quá hạn',
    'tasks.columns.origin': 'Người tạo',
    'tasks.delete.title': 'Xoá việc cần làm?',
    'tasks.delete.message': 'Việc sẽ bị xoá khỏi danh sách việc chung.',
    'tasks.source.zalo': 'Tạo từ Zalo',
    'tasks.source.dashboard': 'Tạo từ dashboard',
    'tasks.meta.createdBy': 'Tạo bởi {name}',
    'tasks.meta.inChat': 'trong {chat}',
    'tasks.actions.create': 'Thêm việc',
    'tasks.create.title': 'Thêm việc cần làm',
    'tasks.create.description': 'Việc được thêm vào danh sách việc chung của zalobot.',
    'tasks.create.submit': 'Lưu việc',
    'tasks.create.success': 'Đã thêm việc cần làm',
    'tasks.create.error': 'Không thể thêm việc. Vui lòng thử lại.',
    'tasks.columns.remindAt': 'Nhắc lúc',
    'tasks.remind.pastTime': 'Thời điểm nhắc phải ở tương lai.',
    'tasks.remind.sent': 'Đã nhắc',
    'reminderTimes.add': '+ Thêm giờ nhắc',
    'reminderTimes.remove': 'Xoá giờ nhắc này',
    'reminderTimes.max': 'Tối đa {max} lần nhắc.',
    'reminderTimes.more': '+{count} lần',
    'reminderTimes.sent': 'đã gửi',
    'reminderTarget.channel': 'Gửi nhắc vào',
    'reminderTarget.channelPlaceholder': 'Chọn kênh nhận nhắc...',
    'reminderTarget.channelRequired': 'Chọn kênh Zalo nhận nhắc.',
    'reminderTarget.self': 'Chat riêng với tôi',
    'reminderTarget.noChannels': 'Chưa có kênh Zalo nào đang được listen.',
    'reminderTarget.users': 'Nhắc ai',
    'reminderTarget.usersHint': 'Chọn ít nhất 1 người.',
    'reminderTarget.usersRequired': 'Chọn ít nhất một người được nhắc trong nhóm.',
    'reminderTarget.usersPickChannel': 'Chọn kênh nhận nhắc trước.',
    'reminderTarget.usersPrivate': 'Chat riêng: nhắc chính người này.',
    'reminderTarget.selfPerson': 'Bạn',
    'reminderTarget.usersSearch': 'Tìm thành viên...',
    'reminderTarget.usersMax': 'Chọn tối đa {max} người.',
    'reminderTarget.usersLoading': 'Đang tải thành viên...',
    'reminderTarget.usersUnavailable': 'Chưa lấy được thành viên nhóm (ZCA chưa đăng nhập?).',
    'reminderTarget.usersNone': 'Không có thành viên khớp.',
    'reminderTarget.mode': 'Cách nhắc',
    'reminderTarget.mode.mention': 'Tag trong nhóm',
    'reminderTarget.mode.direct': 'Nhắn riêng',
    'reminderTarget.directIntro': 'Bạn được nhắc trong {chat}.',
    'reminders.columns.target': 'Gửi tới',
    'reminders.columns.completedAt': 'Xong lúc',
    'reminders.tabs': 'Trạng thái lời nhắc',
    'reminders.tab.upcoming': 'Sắp tới',
    'reminders.tab.done': 'Đã xong',
    'reminders.noDone': 'Chưa có lời nhắc nào đã xong',
    'reminders.notifyType.callPrivateOnly': 'Gọi điện chỉ dùng khi gửi vào chat riêng.',
    'task.reminder.header': '⏰ Việc: {title}',
    'task.reminder.due': 'Hạn',
    'task.reminder.completeHint': 'Xong thì nhắn "xong {title}".',
    'reminders.title': 'Nhắc nhở',
    'reminders.subtitle': 'Danh sách lời nhắc tự động qua Zalo & Gọi điện',
    'reminders.columns.notifyType': 'Hình thức',
    'reminders.columns.repeatType': 'Lặp lại',
    'reminders.actions.edit': 'Sửa',
    'reminders.actions.save': 'Lưu',
    'reminders.actions.cancel': 'Hủy',
    'reminders.actions.delete': 'Xóa',
    'reminders.actions.snooze': 'Hoãn 15p',
    'reminders.inlineEdit.saved': 'Đã cập nhật lời nhắc',
    'reminders.delete.confirm': 'Bạn có chắc chắn muốn xóa lời nhắc này không?',
    'reminders.delete.success': 'Đã xóa lời nhắc',
    'reminders.snooze.success': 'Đã hoãn lời nhắc thêm 15 phút',
    'reminders.notifyType.call': 'Gọi điện',
    'reminders.notifyType.text': 'Nhắn tin',
    'reminders.repeatType.none': 'Không lặp',
    'reminders.repeatType.daily': 'Hàng ngày',
    'reminders.repeatType.weekly': 'Hàng tuần',
    'reminders.repeatType.weekdays': 'Ngày thường (T2–T6)',
    'reminders.repeatType.monthly': 'Hàng tháng',
    'reminders.repeatType.yearly': 'Hàng năm',
    'reminderRule.repeat': 'Lặp lại',
    'reminderRule.weekdays': 'Vào các thứ',
    'reminderRule.weekdaysHint': 'Không chọn thì lặp đúng thứ của giờ nhắc.',
    'reminderRule.nag': 'Nhắc lại',
    'reminderRule.nagTaskHint': 'Sau mỗi lần nhắc, nhắc thêm cho tới khi việc xong.',
    'reminderRule.nagReminderHint': 'Sau mỗi lần nhắc, nhắc thêm cho tới khi bấm Đã xong.',
    'reminderRule.nagEvery': 'Mỗi',
    'reminderRule.nagCount': 'Tối đa (lần)',
    'reminderRule.minutes': '{count} phút',
    'reminderRule.hours': '{count} giờ',
    'reminderRule.summaryNag': 'nhắc lại mỗi {every} ×{count}',
    'reminderRule.error.nagEvery': 'Nhắc lại mỗi 5 phút đến 24 giờ.',
    'reminderRule.error.nagCount': 'Nhắc lại từ 1 đến 10 lần.',
    'reminderRule.error.nagTooLong': 'Nhắc lại phải kết thúc trước lần lặp kế tiếp.',
    'reminderRule.error.weekdays': 'Thứ trong tuần không hợp lệ.',
    'reminderRule.nagMessage': 'Nhắc lại lần {index}/{total}',
    'weekday.short.0': 'CN',
    'weekday.short.1': 'T2',
    'weekday.short.2': 'T3',
    'weekday.short.3': 'T4',
    'weekday.short.4': 'T5',
    'weekday.short.5': 'T6',
    'weekday.short.6': 'T7',
    'reminders.placeholder.title': 'Nhập tiêu đề lời nhắc...',
    'reminders.actions.create': 'Thêm lời nhắc',
    'reminders.create.title': 'Thêm lời nhắc',
    'reminders.create.description': 'Bot sẽ nhắc bạn qua Zalo vào thời điểm đã chọn.',
    'reminders.create.remindAt': 'Thời điểm nhắc',
    'reminders.create.pastTime': 'Thời điểm nhắc phải ở tương lai.',
    'reminders.create.submit': 'Lưu lời nhắc',
    'reminders.create.success': 'Đã thêm lời nhắc',
    'reminders.create.error': 'Không thể thêm lời nhắc. Vui lòng thử lại.',
    'period.day': 'Ngày',
    'period.week': 'Tuần',
    'period.month': 'Tháng',
    'period.quarter': 'Quý',
    'period.year': 'Năm',
    'period.all': 'Tất cả',
    'period.prev': 'Kỳ trước',
    'period.next': 'Kỳ sau',
    'period.grain': 'Chu kỳ',
    'period.label.day': 'Ngày {date}',
    'period.label.week': 'Tuần {week} ({range})',
    'period.label.month': 'Tháng {month}/{year}',
    'period.label.quarter': 'Quý {quarter}/{year}',
    'period.label.year': 'Năm {year}',
    'period.label.all': 'Tất cả thời gian',
    'chart.toggleShow': 'Hiện biểu đồ',
    'chart.toggleHide': 'Ẩn biểu đồ',
    'chart.incomeVsExpense': 'Xu hướng Thu vs Chi',
    'chart.cashflow': 'Dòng tiền ròng',
    'chart.noData': 'Chưa có dữ liệu xu hướng',
    'chart.income': 'Thu nhập',
    'chart.expense': 'Chi tiêu',
    'chart.net': 'Dòng tiền',
    'googleStorage.title': 'Google Drive lưu trữ',
    'googleStorage.subtitle': 'Tài khoản Google mà bot dùng để lưu media của mọi kênh Zalo.',
    'googleStorage.forbidden': 'Chỉ admin xem và đổi được tài khoản Google lưu trữ.',
    'googleStorage.openRoot': 'Mở thư mục zalobot trên Drive',
    'googleStorage.howItWorks.title': 'Cách hoạt động',
    'googleStorage.howItWorks.storage':
      'Ảnh, video, file và hoá đơn của mỗi kênh được lưu vào thư mục zalobot/<mã kênh> trên Drive và album riêng của kênh trên Photos.',
    'googleStorage.howItWorks.switch':
      'Đổi tài khoản thì media mới vào tài khoản mới. File cũ vẫn ở tài khoản cũ, link cũ vẫn có trong lịch sử lưu trữ của từng kênh.',
    'googleStorage.howItWorks.logout':
      'Đăng xuất thì bot ngừng lưu media lên Google cho tới khi có admin đăng nhập lại; file đã lưu giữ nguyên.',
    'googleStorage.howItWorks.personal':
      'Mỗi người chỉ có một token Google, nên đăng xuất cũng ngắt kết nối Google cá nhân của admin đang giữ tài khoản này.',
    'settings.title': 'Cài đặt chung',
    'settings.subtitle': 'Quản lý danh mục thu chi và cấu hình hệ thống',
    'settings.tabs.categories': 'Danh mục Thu & Chi',
    'settings.tabs.preferences': 'Tùy chọn hệ thống',
    'settings.categories.expenseTitle': 'Danh mục Chi tiêu',
    'settings.categories.incomeTitle': 'Danh mục Thu nhập',
    'settings.categories.addExpense': '+ Thêm danh mục chi',
    'settings.categories.addIncome': '+ Thêm danh mục thu',
    'settings.categories.namePlaceholder': 'Nhập tên danh mục...',
    'settings.categories.name': 'Tên danh mục',
    'settings.categories.type': 'Loại',
    'settings.categories.count': '{count} danh mục',
    'settings.categories.empty': 'Chưa có danh mục nào',
    'settings.categories.deleteConfirm': 'Bạn có chắc chắn muốn xóa danh mục này không?',
    'settings.categories.created': 'Đã tạo danh mục thành công',
    'settings.categories.updated': 'Đã cập nhật danh mục',
    'settings.categories.deleted': 'Đã xóa danh mục',
    'settings.categories.exists': 'Danh mục này đã tồn tại',
    'settings.preferences.languageDescription': 'Hỗ trợ Tiếng Việt và English',
    'settings.preferences.themeTitle': 'Giao diện & Chủ đề',
    'settings.preferences.themeDescription': 'Chế độ Sáng / Tối (Light & Dark mode)',
    'settings.preferences.supported': 'Đã hỗ trợ',
    'settings.preferences.reactScanTitle': 'React Scan',
    'settings.preferences.reactScanDescription':
      'Dò tìm render chậm ngay trên trình duyệt này. Chỉ bật khi cần kiểm tra hiệu năng.',
    'settings.preferences.reactScanEnabled': 'Đang bật',
    'settings.preferences.reactScanDisabled': 'Đang tắt',
    'settings.preferences.walletManagementTitle': 'Quản lý số dư & Cân chỉnh ví',
    'settings.preferences.walletManagementDescription':
      'Kiểm tra số dư thực tế và cân chỉnh số dư trên sổ cho khớp với tiền trong ví hoặc tài khoản ngân hàng',
    'public.brand': 'zalobot',
    'public.supportEmail': 'datdoan.dev@gmail.com',
    'public.updated': 'CẬP NHẬT: 24/08/2026',
    'public.about.navigation': 'Điều hướng thông tin',
    'public.about.privacy': 'Quyền riêng tư',
    'public.about.terms': 'Điều khoản',
    'public.about.eyebrow': 'TRỢ LÝ CÁ NHÂN TRÊN ZALO',
    'public.about.title': 'Quản lý kế hoạch và tài chính cá nhân, gọn trong một nơi.',
    'public.about.description':
      'zalobot giúp bạn ghi nhận thu chi, theo dõi công nợ, tạo lời nhắc và đồng bộ lịch trình hoặc việc cần làm với Google khi bạn lựa chọn kết nối.',
    'public.about.openZalo': 'Mở Zalo để bắt đầu',
    'public.about.features': 'Tính năng zalobot',
    'public.about.financeTitle': 'Quản lý tài chính',
    'public.about.financeDescription':
      'Ghi nhận thu chi, theo dõi khoản vay và xem lại tổng quan theo thời gian.',
    'public.about.planningTitle': 'Kế hoạch rõ ràng',
    'public.about.planningDescription':
      'Tạo nhắc nhở, theo dõi việc cần làm và quản lý lịch trình cá nhân.',
    'public.about.googleTitle': 'Kết nối Google theo lựa chọn',
    'public.about.googleDescription':
      'Khi bạn cấp quyền, zalobot dùng Google Calendar để thực hiện đúng các lệnh bạn yêu cầu.',
    'public.about.copyright': '© {year} zalobot',
    'public.about.support': 'Hỗ trợ: {email}',
    'public.about.privacyPolicy': 'Privacy Policy',
    'public.about.termsOfService': 'Terms of Service',
    'public.privacy.title': 'Chính sách quyền riêng tư',
    'public.privacy.intro':
      'zalobot tôn trọng quyền riêng tư của bạn. Chính sách này mô tả dữ liệu chúng tôi xử lý, lý do xử lý và các lựa chọn của bạn.',
    'public.privacy.dataTitle': '1. Dữ liệu chúng tôi xử lý',
    'public.privacy.dataDescription':
      'Để vận hành bot, zalobot lưu ID người dùng Zalo, dữ liệu tài chính và kế hoạch do bạn nhập, cùng dữ liệu kỹ thuật cần thiết để duy trì dịch vụ.',
    'public.privacy.scopesIntro':
      'Khi bạn chủ động kết nối Google, chúng tôi chỉ yêu cầu các quyền sau:',
    'public.privacy.profileScope':
      'Thông tin hồ sơ cơ bản và địa chỉ email để nhận diện tài khoản đã kết nối.',
    'public.privacy.calendarScope':
      'Google Calendar để đọc, tạo, cập nhật hoặc xóa sự kiện theo lệnh của bạn.',
    'public.privacy.useTitle': '2. Cách chúng tôi sử dụng dữ liệu Google',
    'public.privacy.useDescription':
      'Dữ liệu Google chỉ được dùng để cung cấp các tính năng Calendar và Tasks mà bạn trực tiếp yêu cầu trong zalobot. Chúng tôi không bán, cho thuê, dùng dữ liệu Google cho quảng cáo, hoặc chuyển dữ liệu đó cho bên thứ ba ngoài nhà cung cấp hạ tầng cần thiết để vận hành dịch vụ.',
    'public.privacy.policyPrefix':
      'Việc zalobot sử dụng và chuyển giao dữ liệu nhận từ Google APIs tuân thủ ',
    'public.privacy.policyLink': 'Google API Services User Data Policy',
    'public.privacy.policySuffix': ', bao gồm yêu cầu Limited Use.',
    'public.privacy.securityTitle': '3. Lưu trữ và bảo mật',
    'public.privacy.securityDescription':
      'Token truy cập Google được mã hóa trước khi lưu trong cơ sở dữ liệu. Chúng tôi áp dụng biện pháp kỹ thuật hợp lý để hạn chế truy cập trái phép; tuy vậy không có phương thức truyền hay lưu trữ dữ liệu nào an toàn tuyệt đối.',
    'public.privacy.retentionTitle': '4. Lưu giữ và xóa dữ liệu',
    'public.privacy.retentionDescription':
      'Chúng tôi lưu dữ liệu trong thời gian cần thiết để cung cấp dịch vụ hoặc theo yêu cầu pháp luật. Bạn có thể yêu cầu thu hồi kết nối Google và xóa token/dữ liệu liên quan bằng cách gửi email tới {email} từ địa chỉ email đã kết nối. Chúng tôi sẽ phản hồi yêu cầu trong thời hạn hợp lý.',
    'public.privacy.contactTitle': '5. Liên hệ',
    'public.privacy.contactDescription':
      'Nếu có câu hỏi về quyền riêng tư hoặc dữ liệu cá nhân, liên hệ {email}.',
    'public.privacy.about': 'Giới thiệu zalobot',
    'public.terms.title': 'Điều khoản sử dụng',
    'public.terms.acceptanceTitle': '1. Chấp nhận điều khoản',
    'public.terms.acceptanceDescription':
      'Bằng việc sử dụng zalobot, bạn đồng ý với các điều khoản này và Chính sách quyền riêng tư. Nếu không đồng ý, vui lòng không sử dụng dịch vụ.',
    'public.terms.scopeTitle': '2. Phạm vi dịch vụ',
    'public.terms.scopeDescription':
      'zalobot là công cụ hỗ trợ quản lý thông tin cá nhân, tài chính, lịch trình và việc cần làm. Dịch vụ không cung cấp tư vấn tài chính, pháp lý hoặc đầu tư chuyên nghiệp.',
    'public.terms.accountTitle': '3. Tài khoản và quyền truy cập',
    'public.terms.accountDescription':
      'Bạn chịu trách nhiệm với các lệnh được gửi từ tài khoản Zalo của mình. Kết nối Google là tự nguyện và có thể được thu hồi theo hướng dẫn tại Chính sách quyền riêng tư.',
    'public.terms.legalTitle': '4. Sử dụng hợp pháp',
    'public.terms.legalDescription':
      'Bạn không được sử dụng zalobot để vi phạm pháp luật, xâm phạm quyền của người khác, can thiệp trái phép vào dịch vụ hoặc gây ảnh hưởng đến hoạt động của hệ thống.',
    'public.terms.changeTitle': '5. Thay đổi dịch vụ',
    'public.terms.changeDescription':
      'Chúng tôi có thể cập nhật dịch vụ hoặc điều khoản khi cần thiết. Phiên bản mới sẽ được công bố trên trang này.',
    'public.terms.contactTitle': '6. Liên hệ',
    'public.terms.contactDescription': 'Liên hệ hỗ trợ: {email}.',
    'zca.directory.fetchedAt': 'Cập nhật lúc {time}',
    'zca.directory.fetchedAtHint':
      'Danh bạ và nhóm Zalo được lưu tạm tối đa 7 ngày. Bấm Làm mới để lấy bản mới nhất từ Zalo.',
    'zca.chatList.type': 'Loại',
    'zca.chatList.listen': 'Lắng nghe',
    'zca.chatList.features': 'Tính năng',
    'zca.chatList.access': 'Quyền tương tác',
    'zca.chatList.actions': 'Thao tác',
    'zca.threadConfig.delete': '🗑️ Xoá cấu hình kênh',
    'zca.threadConfig.deleteConfirm':
      'Xoá hẳn cấu hình của "{name}"? Zalo không còn trả về cuộc trò chuyện này. Trí nhớ hội thoại và lịch sử link Drive/Photos vẫn được giữ. Không thể hoàn tác.',
    'zca.threadConfig.deleteSuccess': 'Đã xoá cấu hình của "{name}".',
    'zca.threadConfig.deleteError': 'Không thể xoá cấu hình kênh. Vui lòng thử lại.',
    'zca.threadConfig.deleteInDirectory':
      'Cuộc trò chuyện vẫn còn trong danh bạ Zalo nên không xoá được. Hãy tắt lắng nghe, hoặc bấm Làm mới nếu danh bạ đã cũ.',
    'zca.memberAccess.title': 'Ai được gọi bot trong nhóm',
    'zca.memberAccess.description':
      'Quyền theo nhóm cộng thêm vào quyền toàn cục: admin và người đã được cấp quyền trên trang Zalo & Người dùng luôn dùng được bot.',
    'zca.memberAccess.mode.grantedUsers': 'Chỉ người đã được cấp quyền toàn cục',
    'zca.memberAccess.mode.grantedUsersHint':
      'Như mặc định: người chưa được cấp quyền mention bot sẽ nhận User ID để gửi admin duyệt.',
    'zca.memberAccess.mode.allMembers': 'Mọi thành viên nhóm',
    'zca.memberAccess.mode.allMembersHint':
      'Ai trong nhóm cũng được @mention hoặc dùng tiền tố để gọi bot.',
    'zca.memberAccess.mode.selectedMembers': 'Thành viên được chọn',
    'zca.memberAccess.mode.selectedMembersHint':
      'Chỉ những thành viên được bật bên dưới được gọi bot trong nhóm này.',
    'zca.memberAccess.searchPlaceholder': 'Tìm theo tên, tên Zalo hoặc UID',
    'zca.memberAccess.filter.all': 'Tất cả',
    'zca.memberAccess.filter.selected': 'Đã chọn',
    'zca.memberAccess.selectedCount': 'Đã chọn {count}/{total}',
    'zca.memberAccess.refresh': 'Làm mới danh sách',
    'zca.memberAccess.loading': 'Đang tải thành viên nhóm…',
    'zca.memberAccess.loadError': 'Không tải được danh sách thành viên nhóm.',
    'zca.memberAccess.retry': 'Thử lại',
    'zca.memberAccess.empty': 'Không có thành viên nào khớp.',
    'zca.memberAccess.badge.admin': 'Admin',
    'zca.memberAccess.badge.global': 'Quyền toàn cục',
    'zca.memberAccess.badge.left': 'Không còn trong nhóm',
    'zca.memberAccess.alwaysAllowed': 'Luôn được dùng bot',
    'zca.memberAccess.toggleMember': 'Cho {name} gọi bot trong nhóm',
    'zca.storageLinks.driveTitle': 'Thư mục Google Drive',
    'zca.storageLinks.photosTitle': 'Album Google Photos',
    'zca.storageLinks.description':
      'Mỗi tài khoản Google từng dùng để lưu media của kênh {name} có một dòng. Đổi tài khoản thì link cũ vẫn giữ ở đây.',
    'zca.storageLinks.current': 'Đang dùng',
    'zca.storageLinks.unknownAccount': 'Tài khoản cũ (không rõ email)',
    'zca.storageLinks.usedRange': 'Dùng từ {from} đến {to}',
    'zca.storageLinks.loading': 'Đang tải danh sách link…',
    'zca.storageLinks.error': 'Không tải được danh sách link. Vui lòng thử lại.',
    'zca.storageLinks.retry': 'Thử lại',
    'zca.storageLinks.empty': 'Kênh này chưa lưu media nào lên Google.',
    'zca.storageLinks.close': 'Đóng',
    'zca.storageLinks.openDrive': 'Xem các thư mục Google Drive của kênh',
    'zca.storageLinks.openPhotos': 'Xem các album Google Photos của kênh',
    'zca.storageLinks.edit': 'Sửa',
    'zca.storageLinks.delete': 'Xoá',
    'zca.storageLinks.save': 'Lưu',
    'zca.storageLinks.saving': 'Đang lưu…',
    'zca.storageLinks.cancel': 'Huỷ',
    'zca.storageLinks.displayNameLabel': 'Tên hiển thị',
    'zca.storageLinks.displayNamePlaceholder': 'Để trống để dùng: {label}',
    'zca.storageLinks.urlLabel': 'Đường link',
    'zca.storageLinks.urlLockedHint': 'Link đang dùng do hệ thống quản lý nên không sửa được.',
    'zca.storageLinks.emailLabel': 'Email tài khoản Google',
    'zca.storageLinks.emailPlaceholder': 'Để trống nếu không rõ',
    'zca.storageLinks.deleteConfirm':
      'Gỡ "{name}" khỏi danh sách? Thư mục hoặc album trên Google vẫn giữ nguyên.',
    'zca.storageLinks.deleteCurrentDisabled':
      'Không xoá được link đang dùng: media mới của kênh đang lưu vào đây.',
    'zca.storageLinks.saveError': 'Không lưu được thay đổi. Vui lòng thử lại.',
    'zca.storageLinks.deleteError': 'Không xoá được link. Vui lòng thử lại.',
    'zca.storageLinks.add': 'Thêm link',
    'zca.storageLinks.addSubmit': 'Thêm',
    'zca.storageLinks.adding': 'Đang thêm…',
    'zca.storageLinks.addHint':
      'Chỉ thêm link có sẵn vào danh sách: không tạo thư mục hay album mới trên Google, media mới vẫn lưu vào link đang dùng.',
    'zca.storageLinks.addError': 'Không thêm được link. Vui lòng thử lại.',
    'zca.storageLinks.displayNameAddPlaceholder': 'Để trống để hiện đường link',
    'zca.storageLinks.urlPlaceholderDrive': 'https://drive.google.com/drive/folders/…',
    'zca.storageLinks.urlPlaceholderPhotos': 'https://photos.google.com/album/…',
    'zca.storageLinks.errors.displayNameTooLong': 'Tên hiển thị tối đa {max} ký tự.',
    'zca.storageLinks.errors.urlRequired': 'Đường link không được để trống.',
    'zca.storageLinks.errors.urlInvalid': 'Đường link phải là địa chỉ https:// hợp lệ.',
    'zca.storageLinks.errors.urlWrongHost': 'Đường link phải thuộc {hosts}.',
    'zca.storageLinks.errors.urlDuplicate': 'Link này đã có trong danh sách.',
    'zca.storageLinks.errors.emailInvalid': 'Email không hợp lệ.',
    'zca.googleAccount.title': 'Tài khoản Google lưu trữ',
    'zca.googleAccount.description':
      'Ảnh, video, file và hoá đơn của mọi kênh được lưu vào Google Drive & Photos của tài khoản này.',
    'zca.googleAccount.loading': 'Đang kiểm tra tài khoản Google…',
    'zca.googleAccount.error': 'Không tải được trạng thái tài khoản Google.',
    'zca.googleAccount.retry': 'Thử lại',
    'zca.googleAccount.disconnected': 'Chưa kết nối',
    'zca.googleAccount.disconnectedHint': 'Media của các kênh chưa được lưu lên Drive và Photos.',
    'zca.googleAccount.connected': 'Đã kết nối',
    'zca.googleAccount.unknownEmail': 'Không lấy được email tài khoản',
    'zca.googleAccount.missingScopes': 'Thiếu quyền Drive/Photos',
    'zca.googleAccount.missingScopesHint':
      'Tài khoản chưa cấp quyền Drive và Photos nên chưa lưu được media. Hãy cấp lại quyền.',
    'zca.googleAccount.login': 'Đăng nhập Google',
    'zca.googleAccount.switch': 'Đổi tài khoản',
    'zca.googleAccount.regrant': 'Cấp lại quyền',
    'zca.googleAccount.logout': 'Đăng xuất',
    'zca.googleAccount.loggingOut': 'Đang đăng xuất…',
    'zca.googleAccount.openingLogin': 'Đang mở…',
    'zca.googleAccount.openDrive': 'Mở Drive',
    'zca.googleAccount.loginHint':
      'Trang đăng nhập Google mở ở tab mới. Đăng nhập xong, quay lại đây để thấy tài khoản mới.',
    'zca.googleAccount.logoutConfirm':
      'Đăng xuất {email}? Bot sẽ ngừng lưu media lên Google cho tới khi có người đăng nhập lại. File đã lưu vẫn giữ nguyên trên Google.',
    'zca.googleAccount.loginError': 'Không tạo được link đăng nhập Google. Vui lòng thử lại.',
    'zca.googleAccount.logoutError': 'Đăng xuất Google thất bại. Vui lòng thử lại.',
    'zca.googleAccount.logoutTitle': 'Đăng xuất tài khoản Google lưu trữ?',
  },
  en: {
    'users.merge.action': 'Merge into…',
    'users.merge.actionTitle': 'Merge this duplicate account into another user',
    'users.merge.title': 'Merge accounts',
    'users.merge.description':
      'Traces of {source} (transaction authorship, contact links, reminders, Google connection) move to the target user, then {source} is removed from the system. Finance data is shared, so it does not move.',
    'users.merge.sourceLabel': 'Source account (will be removed)',
    'users.merge.targetLabel': 'Merge into user',
    'users.merge.targetPlaceholder': 'Select target user',
    'users.merge.noTargets': 'There are no other users to merge into.',
    'users.merge.previewTitle': 'Data to be moved',
    'users.merge.previewHint': 'Select a target user to preview the data that will be moved.',
    'users.merge.previewLoading': 'Calculating data to move…',
    'users.merge.previewError': 'Unable to load the merge preview. Please try again.',
    'users.merge.previewEmpty': 'The source account has no data to move.',
    'users.merge.table.financeTransactions': 'Transactions recorded by this account',
    'users.merge.table.debtContacts': 'Linked contacts',
    'users.merge.table.reminders': 'Reminders',
    'users.merge.table.googleToken': 'Google connection',
    'users.merge.conflicts':
      'The target user is already linked to a contact, so {contacts} link(s) of the source account will be removed.',
    'users.merge.googleToken.keepSource': 'The source account Google connection will be kept.',
    'users.merge.googleToken.keepTarget': 'The target user Google connection will be kept.',
    'users.merge.googleToken.none': 'The source account has no Google connection.',
    'users.merge.botAccountWarning': "The bot's own ZCA account cannot be merged.",
    'users.merge.irreversible': 'I understand this action cannot be undone.',
    'users.merge.confirm': 'Merge accounts',
    'users.merge.merging': 'Merging…',
    'users.merge.cancel': 'Cancel',
    'users.merge.close': 'Close',
    'users.merge.success': 'Merged {source} into {target}.',
    'users.merge.sessionNotice':
      'You merged the account you are signed in with. Reopen the dashboard from the link the bot sends you on Zalo.',
    'users.merge.error': 'Unable to merge accounts. Please try again.',
    'users.linkedContacts.action': '🔗 View linked contacts',
    'users.linkedContacts.badge': '{count} contacts',
    'users.linkedContacts.title': 'Linked contacts',
    'users.linkedContacts.description':
      'Entries in the shared debt-contact directory that are linked to {name}.',
    'users.linkedContacts.loading': 'Loading…',
    'users.linkedContacts.error': 'Unable to load linked contacts. Please try again.',
    'users.linkedContacts.empty': 'No contacts are linked to this account yet.',
    'users.linkedContacts.debts': '{count} debts',
    'users.linkedContacts.openContacts': 'Open Contacts page',
    'users.linkedContacts.close': 'Close',
    'common.refresh': 'Refresh',
    'common.retry': 'Try again',
    'common.logout': 'Log out',
    'common.logoutConfirm.title': 'Log out?',
    'common.logoutConfirm.message':
      "You'll need a new sign-in link from the Zalo Bot to get back in.",
    'common.loggingOut': 'Logging out…',
    'common.close': 'Close',
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'common.language': 'Language',
    'common.loadingDashboard': 'Loading data',
    'common.notSet': 'Not set',
    'common.allCategories': 'All categories',
    'common.hideMoney': 'Hide amounts',
    'common.showMoney': 'Show amounts',
    'common.toggleMoneyVisibility': 'Toggle amount visibility',
    'common.maskedAmount': '••••••',
    'common.today': 'Today',
    'common.saving': 'Saving...',
    'nav.home': 'Overview',
    'nav.statistics': 'Analytics',
    'nav.contacts': 'People',
    'nav.places': 'Places',
    'nav.debts': 'Loans & Debts',
    'nav.expenses': 'Expenses',
    'nav.income': 'Income',
    'nav.transactions': 'Transactions',
    'nav.analytics': 'Analytics',
    'nav.calendar': 'Calendar',
    'nav.tasks': 'Tasks',
    'nav.reminders': 'Reminders',
    'nav.reports': 'Finance',
    'nav.settings': 'Settings',
    'nav.zca': 'Zalo & Users',
    'nav.googleStorage': 'Google Drive',
    'zca.logout': 'Logout ZCA',
    'zca.refreshDirectory': 'Refresh Zalo directory',
    'zca.logoutConfirm':
      'Are you sure you want to disconnect and logout this ZCA personal account?',
    'zca.logoutSuccess': 'ZCA account logged out successfully.',
    'zca.forbidden.title': 'This page is for admins only',
    'zca.forbidden.body':
      'The account signed in to the dashboard is not an admin. Ask an admin to grant access or sign in with an admin account.',
    'zca.forbidden.backHome': 'Back to overview',
    'nav.activity': 'Activity log',
    'audit.title': 'Activity log',
    'audit.subtitle': 'Who added, changed or deleted data, when and from where.',
    'audit.filter.tables': 'Data',
    'audit.filter.allTables': 'All data',
    'audit.filter.actions': 'Action',
    'audit.filter.allActions': 'All actions',
    'audit.filter.sources': 'Source',
    'audit.filter.allSources': 'All sources',
    'audit.filter.actors': 'Actor',
    'audit.filter.allActors': 'Everyone',
    'audit.filter.from': 'From',
    'audit.filter.to': 'To',
    'audit.filter.technical': 'Show technical records',
    'audit.filter.technicalHint':
      'Google tokens, dashboard sign-in tokens and the sent mark of each reminder time.',
    'audit.filter.record': 'Record {id}',
    'audit.filter.clearRecord': 'Clear record filter',
    'audit.filter.clearAll': 'Clear filters',
    'audit.filter.open': 'Filters',
    'audit.filter.openCount': 'Filters · {count}',
    'audit.filter.sheetTitle': 'Filter the log',
    'audit.filter.done': 'Done',
    'audit.columns.time': 'Time',
    'audit.columns.actor': 'Actor',
    'audit.columns.action': 'Action',
    'audit.columns.record': 'Data',
    'audit.columns.changes': 'Changed fields',
    'audit.view': 'View',
    'audit.viewTitle': 'View the data before and after the change',
    'audit.action.insert': 'Added',
    'audit.action.update': 'Changed',
    'audit.action.remove': 'Deleted',
    'audit.source.dashboard': 'Dashboard',
    'audit.source.zalo': 'Zalo',
    'audit.source.system': 'System',
    'audit.source.legacy': 'Legacy',
    'audit.group.finance': 'Finance',
    'audit.group.planning': 'Planning',
    'audit.group.system': 'System',
    'audit.table.finance_transactions': 'Transaction',
    'audit.table.debts': 'Debt',
    'audit.table.debt_payments': 'Debt payment',
    'audit.table.debt_payment_allocations': 'Debt allocation',
    'audit.table.debt_contacts': 'Contact',
    'audit.table.finance_places': 'Place',
    'audit.table.user_categories': 'Category',
    'audit.table.tasks': 'Task',
    'audit.table.task_reminder_times': 'Task reminder time',
    'audit.table.calendar_events': 'Calendar event',
    'audit.table.reminders': 'Reminder',
    'audit.table.reminder_times': 'Reminder time',
    'audit.table.users': 'User',
    'audit.table.zca_thread_configs': 'Channel settings',
    'audit.table.channel_storage_links': 'Channel storage',
    'audit.table.user_tokens': 'Google connection',
    'audit.table.dashboard_exchange_tokens': 'Dashboard sign-in',
    'audit.actor.system': 'System',
    'audit.actor.unknown': 'Unknown',
    'audit.actor.unnamed': 'Unnamed (…{suffix})',
    'audit.channel.direct': 'Direct chat',
    'audit.channel.group': 'Group {name}',
    'audit.channel.groupUnnamed': 'Zalo group',
    'audit.bulk': 'Bulk',
    'audit.bulkHint':
      'Bulk change by criteria: no record id and no copy of the data before the change.',
    'audit.legacyHint':
      'Legacy record: the person shown created the row and may not be the one who changed it.',
    'audit.moreFields': '+{count}',
    'audit.empty': 'No activity matches the filters.',
    'audit.error': 'Could not load the activity log. Please try again.',
    'audit.range': '{from}–{to} of {total}',
    'audit.prev': 'Previous page',
    'audit.next': 'Next page',
    'audit.detail.title': 'Change details',
    'audit.detail.field': 'Field',
    'audit.detail.before': 'Before',
    'audit.detail.after': 'After',
    'audit.detail.value': 'Value',
    'audit.detail.noData': 'No detailed data.',
    'audit.detail.loading': 'Loading details…',
    'audit.detail.error': 'Could not load the details. Please try again.',
    'audit.detail.recordId': 'Record id',
    'audit.detail.channel': 'Channel',
    'audit.detail.recordHistory': 'History of this record',
    'nav.personalSpace': 'Personal',
    'session.title': 'Signed in as',
    'session.owner': 'System owner (sign-in code)',
    'session.unknownName': 'Unknown name',
    'session.roleAdmin': 'Admin',
    'session.roleUser': 'User',
    'session.copyId': 'Copy ID {id}',
    'session.copied': 'Copied',
    'nav.section.overview': 'OVERVIEW',
    'nav.section.finance': 'FINANCE',
    'nav.section.planning': 'PLANNING',
    'nav.section.data': 'DATA',
    'nav.section.system': 'SYSTEM',
    'nav.section.other': 'OTHER',
    'nav.dark': 'Dark mode',
    'nav.light': 'Light mode',
    'nav.menu': 'Navigation menu',
    'nav.openMenu': 'Open navigation menu',
    'nav.closeMenu': 'Close navigation menu',
    'nav.more': 'More',
    'nav.moreTitle': 'All sections',
    'pullToRefresh.pull': 'Pull to refresh',
    'pullToRefresh.release': 'Release to refresh',
    'pullToRefresh.refreshing': 'Refreshing…',
    'nav.tab.debts': 'Debts',
    'nav.tabBar': 'Quick navigation',
    'web.language.vi': 'Tiếng Việt',
    'web.language.en': 'English',
    'reminder.header.text': '⏰ Reminder: {title}',
    'reminder.header.call': '📞 Reminder call: {title}',
    'reminder.done': '✅ Done',
    'reminder.snooze': '⏳ Remind me in 15 minutes',
    'table.searchPlaceholder': 'Quick search...',
    'table.filter.all': 'All',
    'table.filter.receivable': 'Lent',
    'table.filter.payable': 'Borrowed',
    'table.filter.income': 'Income',
    'table.filter.expense': 'Expense',
    'table.ordinal': 'No.',
    'table.id': 'ID',
    'table.rowsCount': '{count} rows',
    'table.loadMore': 'Load more',
    'table.loadedOf': 'Loaded {loaded}/{total} rows',
    'dashboard.columns.createdBy': 'Created by',
    'dashboard.columns.receipt': 'Receipt',
    'transactions.source.dashboard': 'Dashboard',
    'transactions.source.directChat': 'Direct chat',
    'transactions.source.group': 'Group {name}',
    'transactions.source.groupUnnamed': 'Zalo group',
    'transactions.receipt.title': 'Receipt image',
    'transactions.receipt.open': 'Open image',
    'transactions.receipt.error': 'Could not load the image',
    'transactions.receipt.view': 'View receipt image',
    'transactions.receipt.showAll': 'Show receipt images',
    'transactions.receipt.hideAll': 'Hide receipt images',
    'table.columnFilter.open': 'Filter by {column}',
    'table.columnFilter.clear': 'Clear filter',
    'table.columnFilter.clearAll': 'Clear all filters',
    'table.columnFilter.search': 'Search…',
    'table.columnFilter.contains': 'Contains…',
    'table.columnFilter.noOptions': 'No options',
    'table.columnFilter.min': 'From',
    'table.columnFilter.max': 'To',
    'table.columnFilter.any': 'All',
    'table.columnFilter.hasReceipt': 'With image',
    'table.columnFilter.noReceipt': 'Without image',
    'table.columnFilter.noPlace': 'No place',
    'table.columnFilter.unknownCreator': 'Unknown name (…{suffix})',
    'transactions.details.title': 'Transaction details',
    'transactions.details.createdBy': 'Created by',
    'transactions.details.source': 'Source',
    'transactions.details.createdAt': 'Created at',
    'transactions.details.paymentMethod': 'Payment method',
    'transactions.details.currency': 'Currency',
    'transactions.details.note': 'Note',
    'transactions.details.history': 'View change history',
    'table.total': 'Total: {total}',
    'table.columnSettings': 'Column settings',
    'table.columnVisibility': 'Toggle columns',
    'table.showAllColumns': 'Show all',
    'table.resetColumns': 'Reset to default',
    'table.columnsCount': '{visible}/{total} cols',
    'table.scrollHint': 'Scroll horizontally to view more',
    'table.columnRequired': 'Required',
    'table.rowDetails': 'Record details',
    'table.columnsHiddenBadge': '{count} hidden',
    'table.idClickToInspect': 'Click to view ID details & AI Agent prompt templates',
    'table.idModal.title': 'Record Identifier Details',
    'table.idModal.subtitle': 'Database entity identifier & AI Agent prompt templates',
    'table.idModal.tableName': 'Database Table',
    'table.idModal.entityName': 'Domain Entity',
    'table.idModal.fullId': 'Full Identifier (ID)',
    'table.idModal.copyId': 'Copy ID',
    'table.idModal.copied': 'Copied!',
    'table.idModal.agentPromptTitle': 'Quick Prompt Templates for AI Agent (Zalo Bot)',
    'table.idModal.agentPromptDesc':
      'Copy the prompt below and send it to the bot to instruct the AI Agent on this exact record.',
    'table.idModal.promptUpdate': 'Update Record',
    'table.idModal.promptUpdateTemplate': 'Update {entity} with ID: {id} to [new content]',
    'table.idModal.promptDelete': 'Delete Record',
    'table.idModal.promptDeleteTemplate': 'Delete {entity} with ID: {id}',
    'table.idModal.promptDetail': 'Inspect Details',
    'table.idModal.promptDetailTemplate': 'Check details of {entity} with ID: {id}',
    'table.idModal.copyPrompt': 'Copy Prompt',
    'table.idModal.explanation':
      'This ID uniquely identifies the record in table {table}. Providing this ID to AI Agents allows precise lookup or mutation without ambiguity.',
    'table.entity.transactions': 'Finance Transactions (finance_transactions)',
    'table.entity.debts': 'Debts (debts)',
    'table.entity.tasks': 'Tasks (tasks)',
    'table.entity.reminders': 'Reminders (reminders)',
    'table.entity.calendar': 'Calendar Events (calendar_events)',
    'table.entity.contacts': 'Debt Contacts (debt_contacts)',
    'table.entity.places': 'Finance Places (finance_places)',
    'table.entity.categories': 'Categories (categories)',
    'table.entity.budgets': 'Budgets (budgets)',
    'table.entity.cashflow': 'Cashflow (cashflow)',
    'table.entity.general': 'System Record',
    'dashboard.quickStats': 'Financial overview',
    'dashboard.welcome': 'Welcome',
    'dashboard.overviewSubtitle': 'Your finances, tasks, and schedule',
    'dashboard.statisticsSubtitle': 'Current month overview',
    'dashboard.attentionItems': 'Attention needed',
    'dashboard.thisMonthBalance': 'Net income/expense',
    'dashboard.receivableTotal': 'Others owe you',
    'dashboard.payableTotal': 'You owe',
    'dashboard.incomeTotal': 'Total income',
    'dashboard.expenseTotal': 'Total expense',
    'dashboard.netDebt': 'Net loan balance',
    'dashboard.balance': 'Income − Expense',
    'dashboard.tasks': 'Tasks',
    'dashboard.reminders': 'Reminders',
    'dashboard.calendar': 'Upcoming events',
    'dashboard.activity': 'Recent activity',
    'dashboard.transactions': 'Recent transactions',
    'dashboard.openDebts': 'Loans & debts',
    'dashboard.admin': 'Administration',
    'dashboard.usersCount': '{count} users',
    'dashboard.googleConnectedCount': '{count} Google connected',
    'dashboard.connectGoogleTip': 'Connect Google from bot to view data',
    'dashboard.noTasks': 'No pending tasks',
    'dashboard.noReminders': 'No reminders',
    'dashboard.noCalendar': 'No upcoming events',
    'dashboard.noActivity': 'No recent activity',
    'dashboard.viewAll': 'View all',
    'dashboard.noTransactions': 'No transactions',
    'dashboard.noDebts': 'No open loans or debts',
    'dashboard.noExpenses': 'No expenses found',
    'dashboard.noContacts': 'No related people found',
    'dashboard.columns.transaction': 'Transaction',
    'dashboard.columns.note': 'Note',
    'dashboard.columns.amount': 'Amount',
    'dashboard.columns.counterparty': 'Person',
    'dashboard.columns.dueDate': 'Due date',
    'dashboard.columns.remaining': 'Remaining',
    'dashboard.columns.original': 'Original',
    'dashboard.columns.direction': 'Type',
    'dashboard.columns.category': 'Category',
    'dashboard.columns.place': 'Place',
    'dashboard.columns.date': 'Time',
    'dashboard.columns.runningBalance': 'Balance after transaction',
    'dashboard.columns.name': 'Name',
    'dashboard.columns.alias': 'Alias',
    'dashboard.columns.descriptor': 'Note',
    'dashboard.columns.title': 'Title',
    'dashboard.columns.action': 'Action',
    'dashboard.columns.schedule': 'Schedule',
    'dashboard.error.title': 'Unable to load page',
    'dashboard.error.desc':
      'Session expired. Send "dashboard" to the Zalo bot to get a new sign-in code.',
    'auth.loggedOut.title': 'Logged out successfully',
    'auth.loggedOut.desc':
      'Your session has ended securely. Send "dashboard" to the Zalo bot to get a new sign-in code.',
    'auth.sessionExpired.title': 'Session expired',
    'auth.sessionExpired.desc':
      'Your access session has expired or no credentials were found. Send "dashboard" to the Zalo bot to get a new sign-in code.',
    'auth.openZaloBot': 'Open Zalo Bot',
    'auth.clearSessionAndRetry': 'Clear session & retry',
    'auth.backToAbout': 'About zalobot',
    'auth.accessCode.title': 'Sign in with a code',
    'auth.accessCode.desc':
      'Send "dashboard" to the Zalo bot, then enter the sign-in code from its reply.',
    'auth.accessCode.label': 'Sign-in code',
    'auth.accessCode.placeholder': 'e.g. 12345678',
    'auth.accessCode.submit': 'Sign in',
    'auth.accessCode.submitting': 'Signing in...',
    'auth.accessCode.rejected': 'The code is wrong, expired or already used.',
    'auth.accessCode.tooManyAttempts': 'Too many attempts. Please wait 15 minutes.',
    'auth.accessCode.failed': 'Could not sign in. Please try again.',
    'pwa.update.title': 'A new version is available',
    'pwa.update.reload': 'Reload',
    'pwa.offline.banner': 'You are offline — data may be out of date',
    'settings.app.title': 'Mobile app',
    'settings.app.description': 'Install zalobot on your home screen to open it like an app',
    'settings.app.install': 'Install app',
    'settings.app.installed': 'Installed',
    'settings.app.iosHint': 'In Safari: tap Share, then "Add to Home Screen".',
    'settings.app.zaloHint':
      'The Zalo in-app browser cannot install apps. Open this page in Safari or Chrome.',
    'settings.app.unsupported':
      'This browser cannot install apps yet. Please use Chrome or Safari.',
    'debts.title': 'Loans & Debts',
    'debts.subtitle': 'Track money you lent and money you owe',
    'expenses.title': 'Expenses',
    'expenses.subtitle': 'Daily spending, shopping, dining and other expenses',
    'contacts.title': 'People',
    'contacts.subtitle': 'People with loan or spending transactions with you',
    'contacts.actions.edit': 'Edit',
    'contacts.actions.save': 'Save',
    'contacts.actions.cancel': 'Cancel',
    'contacts.actions.combine': 'Combine ({count})',
    'contacts.combineModal.title': 'Combine Contacts / People',
    'contacts.combineModal.desc':
      'Merge duplicate contacts and reassign all debts & transactions to the lead contact.',
    'contacts.combineModal.contactsList': 'Contacts to combine',
    'contacts.combineModal.targetLabel': 'Lead contact',
    'contacts.combineModal.leadBadge': 'Lead contact',
    'contacts.combineModal.linkedUserBadge': 'User Account',
    'contacts.combineModal.debtsBadge': '{count} debts',
    'contacts.combineModal.transactionsBadge': '{count} txs',
    'contacts.combineModal.leadHint':
      'Automatically prioritizes contacts linked to user accounts or with the most debts/transactions as Lead.',
    'contacts.combineModal.resourcesHint':
      'All {debts} debts and {txs} transactions will be reassigned to the lead contact.',
    'contacts.combineModal.mergedName': 'Merged display name',
    'contacts.combineModal.mergedAlias': 'Merged alias',
    'contacts.combineModal.mergedDescriptor': 'Merged address / note',
    'contacts.combineModal.linkedUserLabel': 'Link with User Account',
    'contacts.combineModal.warning':
      'All linked debts and transactions will be reassigned to the lead contact. Secondary contacts will be permanently deleted.',
    'contacts.combineModal.confirm': 'Confirm Combine',
    'contacts.inlineEdit.saved': 'Changes saved',
    'contacts.syncUsers.action': '👥 Sync Zalo users',
    'contacts.syncUsers.running': 'Syncing…',
    'contacts.syncUsers.result':
      'Added {created} contacts · filled {phoneFilled} phones · {suggestions} suggestions',
    'contacts.syncUsers.error': 'Unable to sync Zalo users. Please try again.',
    'contacts.syncUsers.suggestionsTitle': 'Link suggestions (same name)',
    'contacts.syncUsers.suggestionsHint':
      'These users share a name with an unlinked contact. Check it is the same person, then press Link.',
    'contacts.syncUsers.link': 'Link',
    'contacts.syncUsers.linked': 'Linked',
    'contacts.syncUsers.dismiss': 'Dismiss suggestions',
    'contacts.phone.zaloMismatch': 'Zalo: {phone}',
    'contacts.phone.zaloMismatchTitle':
      "The user account's phone differs from this contact's phone",
    'contacts.inlineEdit.noLinkedUser': '— Not linked —',
    'contacts.inlineEdit.linkedUserLabel': 'Link with user account',
    'contacts.combine.success': 'Successfully combined {count} contacts',
    'contacts.placeholder.descriptor': 'Enter address, note...',
    'contacts.placeholder.name': 'Contact / Place name',
    'contacts.placeholder.alias': 'Alias / Short name',
    'contacts.placeholder.phone': 'Enter phone number...',
    'contacts.placeholder.bankAccount': 'Enter bank account number...',
    'contacts.placeholder.bankName': 'Bank name / Code (e.g. VCB, MB)...',
    'contacts.columns.phone': 'Phone number',
    'contacts.columns.bankAccount': 'Bank account',
    'contacts.columns.bankName': 'Bank name',
    'contacts.columns.linkedUser': 'Linked User',
    'contacts.columns.resources': 'Related Data',
    'contacts.actions.profile': 'Profile',
    'contacts.actions.select': 'Select to combine',
    'contacts.actions.selected': 'Selected',
    'contacts.profile.title': 'Profile',
    'contacts.profile.back': 'Contacts',
    'contacts.profile.missingId': 'The contact id is missing from the link.',
    'contacts.profile.notFound':
      'This contact was not found. It may have been deleted or merged into another contact.',
    'contacts.profile.loadError': 'Could not load the profile.',
    'contacts.profile.edit': 'Edit',
    'contacts.profile.save': 'Save',
    'contacts.profile.cancel': 'Cancel',
    'contacts.profile.saved': 'Profile saved',
    'contacts.profile.saveError': 'Could not save the profile. Please try again.',
    'contacts.profile.zaloAccount': 'Zalo account',
    'contacts.profile.noZaloAccount': 'No Zalo account linked',
    'contacts.profile.openZca': 'Open Zalo & Users',
    'contacts.profile.role.admin': 'Admin',
    'contacts.profile.access.granted': 'Access granted',
    'contacts.profile.access.pending': 'Pending',
    'contacts.profile.summary.receivable': 'Lent, still owed',
    'contacts.profile.summary.payable': 'Borrowed, still owing',
    'contacts.profile.summary.income': 'Total income',
    'contacts.profile.summary.expense': 'Total expense',
    'contacts.profile.summary.openDebts': '{count} open',
    'contacts.profile.summary.transactions': '{count} transactions',
    'contacts.profile.section.info': 'Details',
    'contacts.profile.section.debts': 'Debts',
    'contacts.profile.section.transactions': 'Recent transactions',
    'contacts.profile.transactionsLimited': 'Latest {shown} of {total} transactions',
    'contacts.profile.transactionsScope':
      'Includes transactions linked to this contact and those recorded by their Zalo account.',
    'contacts.profile.empty.debts': 'No debts yet.',
    'contacts.profile.empty.transactions': 'No transactions yet.',
    'contacts.profile.field.name': 'Name',
    'contacts.profile.field.alias': 'Alias',
    'contacts.profile.field.descriptor': 'Description',
    'contacts.profile.field.phones': 'Phone numbers',
    'contacts.profile.field.bankAccounts': 'Bank accounts',
    'contacts.profile.field.birthday': 'Birthday',
    'contacts.profile.field.relationship': 'Relationship',
    'contacts.profile.field.address': 'Address',
    'contacts.profile.field.workplace': 'Workplace',
    'contacts.profile.field.notes': 'Notes',
    'contacts.profile.primary': 'Primary',
    'contacts.profile.addPhone': '+ Add phone',
    'contacts.profile.addBankAccount': '+ Add account',
    'contacts.profile.removeRow': 'Remove row',
    'contacts.profile.placeholder.label': 'Label (e.g. Work)',
    'contacts.profile.placeholder.phone': 'Phone number',
    'contacts.profile.placeholder.accountNumber': 'Account number',
    'contacts.profile.placeholder.bankName': 'Bank',
    'contacts.profile.placeholder.address': 'Home address, area...',
    'contacts.profile.placeholder.workplace': 'Company, school, workplace...',
    'contacts.profile.placeholder.notes': 'Personality, repayment habits, contact tips...',
    'contacts.profile.primaryHint':
      'The primary phone and account cannot be cleared here (empty keeps the current value).',
    'contacts.profile.relationship.none': 'Not set',
    'contacts.profile.relationship.family': 'Family',
    'contacts.profile.relationship.friend': 'Friend',
    'contacts.profile.relationship.colleague': 'Colleague',
    'contacts.profile.relationship.partner': 'Partner',
    'contacts.profile.relationship.other': 'Other',
    'contacts.profile.direction.receivable': 'Lent',
    'contacts.profile.direction.payable': 'Borrowed',
    'contacts.profile.type.income': 'Income',
    'contacts.profile.type.expense': 'Expense',
    'contacts.profile.errors.nameRequired': 'The name cannot be empty.',
    'contacts.profile.errors.text_too_long': 'Too long (at most {max} characters).',
    'contacts.profile.errors.notes_too_long': 'Notes can have at most {max} characters.',
    'contacts.profile.errors.birthday_invalid': 'Invalid birthday.',
    'contacts.profile.errors.birthday_future': 'The birthday cannot be in the future.',
    'contacts.profile.errors.relationship_invalid': 'Invalid relationship.',
    'contacts.profile.errors.list_invalid': 'Invalid list.',
    'contacts.profile.errors.too_many_items': 'At most {max} rows.',
    'contacts.profile.errors.label_too_long': 'Labels can have at most {max} characters.',
    'contacts.profile.errors.phone_invalid': 'A phone number must have {min}–{max} digits.',
    'contacts.profile.errors.bank_account_invalid':
      'An account number must have {min}–{max} digits.',
    'zca.profile.view': '👤 View profile',
    'zca.profile.create': '➕ Create profile',
    'zca.profile.createError': 'Could not create the profile. Please try again.',
    'places.title': 'Places & Locations',
    'places.subtitle': 'Stores, restaurants, hospitals and locations used in your transactions',
    'places.actions.create': 'Add place',
    'places.actions.edit': 'Edit',
    'places.actions.save': 'Save',
    'places.actions.cancel': 'Cancel',
    'places.actions.delete': 'Delete',
    'places.columns.name': 'Place / Location name',
    'places.placeholder.name': 'Enter place name...',
    'places.inlineEdit.saved': 'Place updated successfully',
    'places.create.success': 'Place created successfully',
    'places.delete.confirm':
      'Are you sure you want to delete this place? Historical transactions will be preserved.',
    'places.delete.success': 'Place deleted successfully',
    'places.noData': 'No places found',
    'places.columns.transactionCount': 'Transactions',
    'places.actions.combine': 'Combine ({count})',
    'places.selectAll': 'Select all',
    'places.deselectAll': 'Deselect all',
    'places.selectedCount': '{count} selected',
    'places.selectMode': 'Select',
    'places.selectModeDone': 'Done',
    'places.combineModal.title': 'Combine Places / Stores',
    'places.combineModal.desc':
      'Merge duplicate places and reassign all transactions to a single lead place.',
    'places.combineModal.placesList': 'Places to combine',
    'places.combineModal.leadBadge': 'Lead place',
    'places.combineModal.leadHint':
      'Defaults to the place with the highest transaction count. You can select another place if preferred.',
    'places.combineModal.newNameLabel': 'New place name after merge',
    'places.combineModal.transactionsBadge': '{count} transactions',
    'places.combineModal.newNameHint': '{transactions} will be moved to this place.',
    'places.combineModal.setLead': 'Make {name} the main place',
    'places.combineModal.topBadge': 'Top',
    'places.combineModal.warning':
      'All transactions linked to former places will be reassigned to the lead place. Secondary places will be permanently deleted.',
    'places.combineModal.confirm': 'Confirm Combine',
    'places.combine.success': 'Successfully combined {count} places',
    'debts.columns.status': 'Status',
    'debts.columns.settledAt': 'Settled date',
    'debts.columns.currency': 'Currency',
    'debts.status.active': 'Active',
    'debts.status.settled': 'Settled',
    'debts.filter.statusAll': 'All status',
    'debts.filter.allStatus': 'All status',
    'debts.filter.statusActive': 'Active',
    'debts.filter.statusSettled': 'Settled',
    'debts.filter.directionAll': 'All directions',
    'debts.filter.allDirections': 'All directions',
    'debts.stats.receivable': 'Total Receivables (Lent)',
    'debts.stats.payable': 'Total Payables (Borrowed)',
    'debts.stats.activeCount': 'Open Debts Count',
    'debts.stats.settledCount': 'Settled Debts Count',
    'debts.history.title': 'Repayment history',
    'debts.history.paidAmount': 'Paid amount',
    'debts.history.paymentDate': 'Payment date',
    'expenses.columns.paymentMethod': 'Payment method',
    'expenses.columns.currency': 'Currency',
    'expenses.actions.edit': 'Edit',
    'expenses.actions.save': 'Save',
    'expenses.actions.cancel': 'Cancel',
    'expenses.actions.delete': 'Delete',
    'expenses.inlineEdit.saved': 'Expense updated successfully',
    'expenses.delete.confirm': 'Are you sure you want to delete this expense?',
    'expenses.delete.success': 'Expense deleted successfully',
    'expenses.placeholder.category': 'Category...',
    'expenses.placeholder.note': 'Expense note...',
    'expenses.placeholder.amount': 'Amount...',
    'expenses.placeholder.paymentMethod': 'Payment method...',
    'debts.actions.edit': 'Edit',
    'debts.actions.save': 'Save',
    'debts.actions.cancel': 'Cancel',
    'debts.actions.repay': 'Repay',
    'debts.actions.combine': 'Combine Debts ({count})',
    'debts.combineModal.title': 'Combine Debt Records',
    'debts.combineModal.desc': 'Consolidate selected debts into a single parent debt.',
    'debts.combineModal.parentNote': 'Consolidated debt note',
    'debts.combineModal.parentDueDate': 'Consolidated due date',
    'debts.combineModal.warning':
      'Selected debts will become child items under this consolidated debt. Historical payments are fully preserved.',
    'debts.combineModal.mismatchedDirection':
      'Can only combine debts of the same direction (all receivables or all payables).',
    'debts.combineModal.mismatchedCurrency': 'Can only combine debts with the same currency.',
    'debts.combineModal.confirm': 'Confirm Combine',
    'debts.combine.success': 'Successfully combined {count} debts',
    'debts.badge.parent': 'Consolidated ({count})',
    'debts.badge.child': 'Sub-debt',
    'debts.expandChildren': 'Expand sub-debts',
    'debts.collapseChildren': 'Collapse sub-debts',
    'debts.selectedCount': '{count} selected',
    'debts.selectAll': 'Select all',
    'debts.deselectAll': 'Deselect all',
    'debts.selectOne': 'Select',
    'debts.deselectOne': 'Deselect',
    'debts.paidPercent': '{percent}% paid',
    'contacts.combineModal.consolidateDebts':
      'Automatically consolidate debts of the same direction into parent debts',
    'debts.inlineEdit.saved': 'Debt updated successfully',
    'debts.placeholder.counterparty': 'Enter or select person...',
    'debts.placeholder.originalAmount': 'Original amount...',
    'debts.placeholder.remainingAmount': 'Remaining amount...',
    'debts.placeholder.note': 'Debt note...',
    'debts.placeholder.due': 'Due date...',
    'contacts.selectedCount': '{count} selected',
    'contacts.selectAll': 'Select all',
    'contacts.deselectAll': 'Deselect all',
    'transactions.title': 'Transactions',
    'transactions.subtitle': 'Cash flow and transaction history',
    'transactions.actions.edit': 'Edit',
    'transactions.actions.save': 'Save',
    'transactions.actions.cancel': 'Cancel',
    'transactions.actions.delete': 'Delete',
    'transactions.actions.allocateDebts': 'Allocate to Debts',
    'transactions.delete.confirm': 'Are you sure you want to delete this transaction?',
    'transactions.delete.success': 'Transaction deleted successfully',
    'transactions.deleteModal.title': 'Confirm Delete Transaction',
    'transactions.deleteModal.subtitle':
      'Please review transaction details and balance impact below.',
    'transactions.deleteModal.impactExpenseRefund': 'Refunded to wallet balance: +{amount}',
    'transactions.deleteModal.impactExpenseExplain':
      'This expense will be removed from the ledger and your available wallet balance will increase accordingly.',
    'transactions.deleteModal.impactIncomeDeduct': 'Deducted from wallet balance: -{amount}',
    'transactions.deleteModal.impactIncomeExplain':
      'This income will be removed from the ledger and your available wallet balance will decrease accordingly.',
    'transactions.deleteModal.allocationsWarning':
      'This transaction is allocated to {count} debts. Deleting will restore the unpaid debt balances.',
    'transactions.deleteModal.confirmAction': 'Confirm Delete',
    'transactions.inlineEdit.saved': 'Transaction updated successfully',
    'transactions.placeholder.category': 'Enter category...',
    'transactions.placeholder.place': 'Enter a place or store...',
    'transactions.placeholder.note': 'Enter note...',
    'transactions.placeholder.amount': 'Enter amount...',
    'transactions.allocation.title': 'Allocate Transaction to Debts',
    'transactions.allocation.allocated': 'Allocated',
    'transactions.allocation.unallocated': 'Unallocated',
    'transactions.allocation.totalAmount': 'Transaction Amount',
    'transactions.allocation.submit': 'Save Allocations',
    'transactions.allocation.success': 'Debt allocations updated successfully',
    'transactions.allocation.exceededAmount':
      'Total allocated amount cannot exceed transaction amount',
    'transactions.allocation.exceededDebtRemaining': 'Allocated amount exceeds remaining debt',
    'transactions.allocation.noCandidates': 'No matching open debts available for allocation',
    'transactions.allocation.badgeAllocated': '{count} allocations',
    'transactions.allocation.modalSubtitleIncome':
      'Allocate received income to open receivable debts',
    'transactions.allocation.modalSubtitleExpense': 'Allocate expense amount to open payable debts',
    'transactions.allocation.cannotChangeTypeWithAllocations':
      'Cannot change transaction type while active debt allocations exist',
    'transactions.allocation.cannotReduceBelowAllocated':
      'New transaction amount cannot be less than the total allocated amount ({amount})',
    'transactions.allocation.noteOptional': 'Allocation note (optional)',
    'transactions.expandAllocations': 'Expand debt allocations',
    'transactions.collapseAllocations': 'Collapse debt allocations',
    'transactions.badge.allocatedChild': 'Allocation',
    'transactions.allocation.viewDebt': 'View debt record',
    'transactions.allocation.editAllocations': 'Edit allocations',
    'transactions.allocation.candidatesTitle': 'Matching debts ({count})',
    'transactions.allocation.loadingCandidates': 'Loading debts...',
    'transactions.allocation.allocateMax': 'Allocate max',
    'transactions.allocation.originalAmount': 'Original',
    'transactions.allocation.remainingAmount': 'Remaining',
    'transactions.allocation.amountLabel': 'Allocated amount (VND)',
    'debts.badge.paymentChild': 'Debt payment',
    'debts.badge.paymentInstallment': '{count} payments',
    'debts.expandPayments': 'View {count} debt payments',
    'debts.collapsePayments': 'Collapse debt payments',
    'debts.paidProgress': 'Paid {amount}',
    'debts.paidProgressWithCount': 'Paid {amount} ({count} payments)',
    'debts.deletePayment.confirm':
      'Are you sure you want to delete this payment record? The remaining debt amount will be restored.',
    'debts.deletePayment.success': 'Debt payment deleted successfully',
    'debts.payments.linkedTransaction': 'Linked Transaction',
    'debts.actions.create': 'Add debt',
    'debts.actions.delete': 'Delete',
    'debts.create.title': 'Add a debt',
    'debts.create.description': 'Record money lent or borrowed in the shared ledger.',
    'debts.create.occurredAt': 'Date',
    'debts.create.alias': 'Nickname (to tell apart people with the same name)',
    'debts.create.matchedContact': 'Selected from contacts: {name}',
    'debts.create.newContact': 'Create new person «{name}»',
    'debts.create.newContactRequired':
      'Nobody with this name is in the contacts. Pick a suggestion or confirm creating a new person.',
    'debts.create.amountInvalid': 'Amount must be greater than 0.',
    'debts.create.submit': 'Save debt',
    'debts.create.success': 'Debt added',
    'debts.create.error': 'Could not add the debt. Please try again.',
    'debts.delete.title': 'Delete debt?',
    'debts.delete.message':
      'The debt with {name} ({amount}) will be permanently removed from the shared ledger.',
    'debts.delete.paymentsWarning':
      '{count} payments and their transaction allocations are deleted too; the income/expense transactions recorded for those payments stay in the ledger.',
    'debts.delete.childrenWarning':
      '{count} combined sub-debts will be split off and show up as separate debts again.',
    'debts.delete.success': 'Debt deleted',
    'debts.delete.error': 'Could not delete the debt. Please try again.',
    'category.debtRecovery': 'Debt Recovery',
    'category.debtPayment': 'Debt Repayment',
    'category.balanceAdjustment': 'Balance Adjustment',
    'transactions.balanceAdjust.title': 'Adjust Wallet Balance',
    'transactions.balanceAdjust.subtitle':
      'Enter your actual balance to automatically reconcile your ledger balance',
    'transactions.balanceAdjust.currentBalance': 'Current ledger balance',
    'transactions.balanceAdjust.targetBalance': 'New actual balance',
    'transactions.balanceAdjust.targetPlaceholder': 'Enter actual balance...',
    'transactions.balanceAdjust.difference': 'Adjustment difference',
    'transactions.balanceAdjust.diffIncrease': 'Increase (+{amount}) · Recorded as Income',
    'transactions.balanceAdjust.diffDecrease': 'Decrease (-{amount}) · Recorded as Expense',
    'transactions.balanceAdjust.diffZero': 'Actual balance matches current ledger balance ($0)',
    'transactions.balanceAdjust.note': 'Adjustment note',
    'transactions.balanceAdjust.defaultNote': 'Wallet balance adjustment: {current} ➔ {target}',
    'transactions.balanceAdjust.date': 'Effective date & time',
    'transactions.balanceAdjust.submit': 'Confirm Adjustment',
    'transactions.balanceAdjust.success': 'Wallet balance adjusted successfully',
    'transactions.balanceAdjust.actionButton': 'Adjust Balance',
    'transactions.balanceAdjust.invalidAmount': 'Please enter a valid actual balance',
    'analytics.title': 'Reports & Analytics',
    'analytics.subtitle': 'Visualize cashflow trends, spending distribution, and debt structure',
    'analytics.kpi.netSavings': 'Net Savings',
    'analytics.kpi.savingsRate': 'Savings Rate',
    'analytics.periodResults.title': 'Results for the selected period',
    'analytics.currentPosition.title': 'Current financial position',
    'analytics.currentPosition.cashflowBalance': 'Ledger cashflow balance',
    'analytics.currentPosition.receivable': 'Outstanding receivables',
    'analytics.currentPosition.payable': 'Outstanding payables',
    'analytics.currentPosition.netWorth': 'Net worth',
    'analytics.chart.cashflowTrend': 'Cashflow Trend',
    'analytics.chart.spendingDistribution': 'Spending Distribution',
    'analytics.chart.debtBreakdown': 'Debt Structure',
    'analytics.chart.netBalance': 'Net Balance',
    'analytics.chart.walletBalance': 'Wallet Balance Trend',
    'analytics.chart.netCashflow': 'Period Cash Flow',
    'analytics.chart.receivables': 'Receivables (Lent)',
    'analytics.chart.payables': 'Payables (Borrowed)',
    'analytics.emptyChartData': 'No data for the selected period',
    'analytics.topCategories': 'Top Spending Categories',
    'analytics.topDebtors': 'Top Debtors / Creditors',
    'analytics.drilldownTitle': 'Detailed Transactions & Debts',
    'analytics.tab.allCharts': 'All Charts',
    'analytics.tab.cashflow': 'Cashflow Trend',
    'analytics.tab.spending': 'Spending Breakdown',
    'analytics.tab.debts': 'Debt Structure',
    'analytics.tab.records': 'Detailed Records',
    'analytics.cashflow.breakdownTitle': 'Cashflow Breakdown by Period',
    'analytics.cashflow.avgDailyExpense': 'Avg Daily Expense',
    'analytics.cashflow.avgDailyIncome': 'Avg Daily Income',
    'analytics.cashflow.totalPeriod': 'Period Total',
    'analytics.cashflow.column.period': 'Time Period / Interval',
    'analytics.cashflow.column.income': 'Total Income (+)',
    'analytics.cashflow.column.expense': 'Total Expense (-)',
    'analytics.cashflow.column.netCashflow': 'Net Surplus / Deficit',
    'analytics.cashflow.column.balance': 'Ending Balance',
    'calendar.title': 'Calendar',
    'calendar.subtitle': 'Shared calendar, saved in zalobot and copied to Google',
    'calendar.columns.description': 'Description',
    'calendar.columns.location': 'Location',
    'calendar.columns.endAt': 'End time',
    'calendar.columns.sync': 'Google Calendar',
    'calendar.actions.edit': 'Edit',
    'calendar.actions.save': 'Save',
    'calendar.actions.cancel': 'Cancel',
    'calendar.actions.delete': 'Delete',
    'calendar.inlineEdit.saved': 'Event updated successfully',
    'calendar.delete.confirm': 'Are you sure you want to delete this event?',
    'calendar.delete.success': 'Event deleted successfully',
    'calendar.placeholder.title': 'Event title...',
    'calendar.placeholder.location': 'Location...',
    'calendar.placeholder.description': 'Event description...',
    'calendar.view.grid': 'Month Grid',
    'calendar.view.table': 'List View',
    'calendar.view.agenda': 'Agenda',
    'calendar.agenda.prevWeek': 'Previous week',
    'calendar.agenda.nextWeek': 'Next week',
    'calendar.allDay': 'All day',
    'calendar.nav.today': 'Today',
    'calendar.nav.prev': 'Previous Month',
    'calendar.nav.next': 'Next Month',
    'calendar.day.mon': 'Mon',
    'calendar.day.tue': 'Tue',
    'calendar.day.wed': 'Wed',
    'calendar.day.thu': 'Thu',
    'calendar.day.fri': 'Fri',
    'calendar.day.sat': 'Sat',
    'calendar.day.sun': 'Sun',
    'calendar.moreEvents': '+{count} more',
    'calendar.selectedDayEvents': 'Events on {date}',
    'calendar.noEventsOnDay': 'No events on this day',
    'calendar.quickCreate': 'Quick Add Event',
    'calendar.add': 'Add event',
    'calendar.create.title': 'New event',
    'calendar.create.success': 'Event added',
    'calendar.edit.title': 'Edit event',
    'calendar.details.title': 'Event details',
    'calendar.details.created': 'Created {date}',
    'calendar.details.when': 'When',
    'calendar.details.origin': 'Origin',
    'calendar.delete.title': 'Delete event?',
    'calendar.delete.message':
      'The event is removed from zalobot, and from Google Calendar while the account holding its copy is still connected.',
    'calendar.upcoming': 'Upcoming · 14 days',
    'calendar.upcoming.empty': 'No events in the next 14 days',
    'calendar.dayEmpty': 'No events',
    'calendar.tomorrow': 'Tomorrow',
    'calendar.summary.today': 'Today',
    'calendar.summary.next7': 'Next 7 days',
    'calendar.summary.month': 'This month',
    'calendar.summary.unsynced': 'Not on Google',
    'calendar.filter.unsyncedOnly': 'Showing events not on Google',
    'calendar.filter.clear': 'Clear filter',
    'calendar.search.open': 'Search events',
    'calendar.localOnlyTip':
      'Google is not connected: events are still saved in zalobot, just without Google Calendar reminders.',
    'calendar.status.ongoing': 'Happening now',
    'calendar.status.past': 'Past',
    'calendar.duration.minutes': '{count} min',
    'calendar.duration.hours': '{count} h',
    'calendar.duration.hoursMinutes': '{hours} h {minutes} min',
    'calendar.duration.days': '{count} days',
    'calendar.sync.synced': 'On Google',
    'calendar.sync.pending': 'Syncing',
    'calendar.sync.failed': 'Google sync failed',
    'calendar.sync.local': 'Saved in app only',
    'calendar.sync.otherAccount': 'In a previous Google account',
    'calendar.sync.account': 'Google copy: {email}',
    'calendar.sync.resync': 'Sync again',
    'calendar.sync.resynced': 'Synced to Google',
    'calendar.source.zalo': 'Created from Zalo',
    'calendar.source.dashboard': 'Created from the dashboard',
    'calendar.source.google': 'Created in Google Calendar',
    'calendar.meta.createdBy': 'By {name}',
    'calendar.meta.inChat': 'in {chat}',
    'calendar.reminders.label': 'Reminders',
    'calendar.reminders.none': 'No reminder',
    'calendar.reminders.atStart': 'At start',
    'calendar.reminders.minutes': '{count} min before',
    'calendar.reminders.hours': '{count} h before',
    'calendar.reminders.days': '{count} days before',
    'calendar.form.title': 'Title',
    'calendar.form.allDay': 'All day',
    'calendar.form.start': 'Start',
    'calendar.form.end': 'End',
    'calendar.form.location': 'Location',
    'calendar.form.description': 'Description',
    'calendar.form.invalidRange': 'The end must be after the start',
    'tasks.title': 'Tasks',
    'tasks.subtitle': 'Shared task list, stored in zalobot',
    'tasks.columns.status': 'Status',
    'tasks.columns.notes': 'Notes',
    'tasks.columns.updatedAt': 'Updated',
    'tasks.status.needsAction': 'Pending',
    'tasks.status.completed': 'Completed',
    'tasks.placeholder.title': 'Enter task title...',
    'tasks.placeholder.notes': 'Enter notes...',
    'tasks.placeholder.due': 'Due date...',
    'tasks.actions.edit': 'Edit',
    'tasks.actions.save': 'Save',
    'tasks.actions.cancel': 'Cancel',
    'tasks.actions.delete': 'Delete',
    'tasks.actions.complete': 'Complete',
    'tasks.inlineEdit.saved': 'Task updated successfully',
    'tasks.inlineEdit.error': 'Could not save the task. Please try again.',
    'tasks.delete.success': 'Task deleted successfully',
    'tasks.filter.all': 'All',
    'tasks.filter.needsAction': 'Pending',
    'tasks.filter.completed': 'Completed',
    'tasks.stats.total': 'Total tasks',
    'tasks.stats.pending': 'Pending',
    'tasks.stats.completed': 'Completed',
    'tasks.stats.overdue': 'Overdue',
    'tasks.columns.origin': 'Created by',
    'tasks.delete.title': 'Delete task?',
    'tasks.delete.message': 'The task is removed from the shared task list.',
    'tasks.source.zalo': 'Created from Zalo',
    'tasks.source.dashboard': 'Created from the dashboard',
    'tasks.meta.createdBy': 'Created by {name}',
    'tasks.meta.inChat': 'in {chat}',
    'tasks.actions.create': 'Add task',
    'tasks.create.title': 'Add a task',
    'tasks.create.description': 'The task is added to the shared zalobot task list.',
    'tasks.create.submit': 'Save task',
    'tasks.create.success': 'Task added',
    'tasks.create.error': 'Could not add the task. Please try again.',
    'tasks.columns.remindAt': 'Remind at',
    'tasks.remind.pastTime': 'The reminder time must be in the future.',
    'tasks.remind.sent': 'Reminded',
    'reminderTimes.add': '+ Add a time',
    'reminderTimes.remove': 'Remove this time',
    'reminderTimes.max': 'At most {max} reminder times.',
    'reminderTimes.more': '+{count} more',
    'reminderTimes.sent': 'sent',
    'reminderTarget.channel': 'Send reminder to',
    'reminderTarget.channelPlaceholder': 'Choose a chat...',
    'reminderTarget.channelRequired': 'Choose the Zalo chat that gets the reminder.',
    'reminderTarget.self': 'My private chat',
    'reminderTarget.noChannels': 'No Zalo chat is being listened to yet.',
    'reminderTarget.users': 'Who to remind',
    'reminderTarget.usersHint': 'Pick at least one person.',
    'reminderTarget.usersRequired': 'Pick at least one person to remind in the group.',
    'reminderTarget.usersPickChannel': 'Choose the chat first.',
    'reminderTarget.usersPrivate': 'Private chat: reminds this person.',
    'reminderTarget.selfPerson': 'You',
    'reminderTarget.usersSearch': 'Search members...',
    'reminderTarget.usersMax': 'Pick at most {max} people.',
    'reminderTarget.usersLoading': 'Loading members...',
    'reminderTarget.usersUnavailable': 'Could not load the group members (is ZCA logged in?).',
    'reminderTarget.usersNone': 'No matching member.',
    'reminderTarget.mode': 'How to remind',
    'reminderTarget.mode.mention': 'Tag in the group',
    'reminderTarget.mode.direct': 'Private message',
    'reminderTarget.directIntro': 'You are reminded in {chat}.',
    'reminders.columns.target': 'Sent to',
    'reminders.columns.completedAt': 'Done at',
    'reminders.tabs': 'Reminder status',
    'reminders.tab.upcoming': 'Upcoming',
    'reminders.tab.done': 'Done',
    'reminders.noDone': 'No finished reminders yet',
    'reminders.notifyType.callPrivateOnly': 'Calls only work for a private chat.',
    'task.reminder.header': '⏰ Task: {title}',
    'task.reminder.due': 'Due',
    'task.reminder.completeHint': 'Done? Tell the bot "done {title}".',
    'reminders.title': 'Reminders',
    'reminders.subtitle': 'Automated reminders via Zalo & Call',
    'reminders.columns.notifyType': 'Type',
    'reminders.columns.repeatType': 'Repeat',
    'reminders.actions.edit': 'Edit',
    'reminders.actions.save': 'Save',
    'reminders.actions.cancel': 'Cancel',
    'reminders.actions.delete': 'Delete',
    'reminders.actions.snooze': 'Snooze 15m',
    'reminders.inlineEdit.saved': 'Reminder updated successfully',
    'reminders.delete.confirm': 'Are you sure you want to delete this reminder?',
    'reminders.delete.success': 'Reminder deleted successfully',
    'reminders.snooze.success': 'Reminder snoozed for 15 minutes',
    'reminders.notifyType.call': 'Call',
    'reminders.notifyType.text': 'Message',
    'reminders.repeatType.none': 'None',
    'reminders.repeatType.daily': 'Daily',
    'reminders.repeatType.weekly': 'Weekly',
    'reminders.repeatType.weekdays': 'Weekdays (Mon–Fri)',
    'reminders.repeatType.monthly': 'Monthly',
    'reminders.repeatType.yearly': 'Yearly',
    'reminderRule.repeat': 'Repeat',
    'reminderRule.weekdays': 'On',
    'reminderRule.weekdaysHint': 'None picked: repeats on the weekday of the time.',
    'reminderRule.nag': 'Remind again',
    'reminderRule.nagTaskHint': 'After each reminder, remind again until the task is done.',
    'reminderRule.nagReminderHint': 'After each reminder, remind again until marked done.',
    'reminderRule.nagEvery': 'Every',
    'reminderRule.nagCount': 'At most (times)',
    'reminderRule.minutes': '{count} min',
    'reminderRule.hours': '{count} h',
    'reminderRule.summaryNag': 'again every {every} ×{count}',
    'reminderRule.error.nagEvery': 'Remind again every 5 minutes to 24 hours.',
    'reminderRule.error.nagCount': 'Remind again 1 to 10 times.',
    'reminderRule.error.nagTooLong': 'Reminding again must end before the next repeat.',
    'reminderRule.error.weekdays': 'Invalid weekday.',
    'reminderRule.nagMessage': 'Reminder again {index}/{total}',
    'weekday.short.0': 'Sun',
    'weekday.short.1': 'Mon',
    'weekday.short.2': 'Tue',
    'weekday.short.3': 'Wed',
    'weekday.short.4': 'Thu',
    'weekday.short.5': 'Fri',
    'weekday.short.6': 'Sat',
    'reminders.placeholder.title': 'Reminder title...',
    'reminders.actions.create': 'Add reminder',
    'reminders.create.title': 'Add a reminder',
    'reminders.create.description': 'The bot reminds you on Zalo at the chosen time.',
    'reminders.create.remindAt': 'Remind at',
    'reminders.create.pastTime': 'The reminder time must be in the future.',
    'reminders.create.submit': 'Save reminder',
    'reminders.create.success': 'Reminder added',
    'reminders.create.error': 'Could not add the reminder. Please try again.',
    'period.day': 'Day',
    'period.week': 'Week',
    'period.month': 'Month',
    'period.quarter': 'Quarter',
    'period.year': 'Year',
    'period.all': 'All',
    'period.prev': 'Previous period',
    'period.next': 'Next period',
    'period.grain': 'Period',
    'period.label.day': '{date}',
    'period.label.week': 'Week {week} ({range})',
    'period.label.month': '{month}/{year}',
    'period.label.quarter': 'Q{quarter}/{year}',
    'period.label.year': '{year}',
    'period.label.all': 'All time',
    'chart.toggleShow': 'Show chart',
    'chart.toggleHide': 'Hide chart',
    'chart.incomeVsExpense': 'Income vs Expense Trend',
    'chart.cashflow': 'Net cashflow',
    'chart.noData': 'No trend data available',
    'chart.income': 'Income',
    'chart.expense': 'Expense',
    'chart.net': 'Net cashflow',
    'googleStorage.title': 'Google Drive storage',
    'googleStorage.subtitle': 'The Google account the bot saves every Zalo channel’s media to.',
    'googleStorage.forbidden': 'Only admins can view and change the Google storage account.',
    'googleStorage.openRoot': 'Open the zalobot folder on Drive',
    'googleStorage.howItWorks.title': 'How it works',
    'googleStorage.howItWorks.storage':
      'Images, videos, files and receipts of each channel go to the zalobot/<channel id> folder on Drive and the channel’s own album on Photos.',
    'googleStorage.howItWorks.switch':
      'Switching accounts sends new media to the new account. Old files stay in the old account, and old links remain in each channel’s storage history.',
    'googleStorage.howItWorks.logout':
      'Signing out stops the bot from saving media to Google until an admin signs in again; saved files stay.',
    'googleStorage.howItWorks.personal':
      'Each person has one Google token, so signing out also disconnects the personal Google connection of the admin holding this account.',
    'settings.title': 'General Settings',
    'settings.subtitle': 'Manage finance categories and system configuration',
    'settings.tabs.categories': 'Categories',
    'settings.tabs.preferences': 'Preferences',
    'settings.categories.expenseTitle': 'Expense Categories',
    'settings.categories.incomeTitle': 'Income Categories',
    'settings.categories.addExpense': '+ Add Expense Category',
    'settings.categories.addIncome': '+ Add Income Category',
    'settings.categories.namePlaceholder': 'Enter category name...',
    'settings.categories.name': 'Category Name',
    'settings.categories.type': 'Type',
    'settings.categories.count': '{count} categories',
    'settings.categories.empty': 'No categories yet',
    'settings.categories.deleteConfirm': 'Are you sure you want to delete this category?',
    'settings.categories.created': 'Category created successfully',
    'settings.categories.updated': 'Category updated successfully',
    'settings.categories.deleted': 'Category deleted successfully',
    'settings.categories.exists': 'Category already exists',
    'settings.preferences.languageDescription': 'Support Vietnamese and English',
    'settings.preferences.themeTitle': 'Interface & Theme',
    'settings.preferences.themeDescription': 'Light and Dark mode',
    'settings.preferences.supported': 'Supported',
    'settings.preferences.reactScanTitle': 'React Scan',
    'settings.preferences.reactScanDescription':
      'Detect slow renders in this browser. Enable only while investigating performance.',
    'settings.preferences.reactScanEnabled': 'Enabled',
    'settings.preferences.reactScanDisabled': 'Disabled',
    'settings.preferences.walletManagementTitle': 'Wallet & Balance Management',
    'settings.preferences.walletManagementDescription':
      'Verify and reconcile ledger balance with your actual cash or bank account balance',
    'public.brand': 'zalobot',
    'public.supportEmail': 'datdoan.dev@gmail.com',
    'public.updated': 'UPDATED: 24/08/2026',
    'public.about.navigation': 'Information navigation',
    'public.about.privacy': 'Privacy',
    'public.about.terms': 'Terms',
    'public.about.eyebrow': 'YOUR PERSONAL ZALO ASSISTANT',
    'public.about.title': 'Manage your personal finances and plans in one place.',
    'public.about.description':
      'zalobot helps you record income and expenses, track debts, create reminders, and sync your calendar or tasks with Google when you choose to connect.',
    'public.about.openZalo': 'Open Zalo to get started',
    'public.about.features': 'zalobot features',
    'public.about.financeTitle': 'Financial management',
    'public.about.financeDescription':
      'Record income and expenses, track loans, and review your overview over time.',
    'public.about.planningTitle': 'Clear planning',
    'public.about.planningDescription':
      'Create reminders, track tasks, and manage your personal schedule.',
    'public.about.googleTitle': 'Google connection by choice',
    'public.about.googleDescription':
      'When you grant permission, zalobot uses Google Calendar only to perform the actions you request.',
    'public.about.copyright': '© {year} zalobot',
    'public.about.support': 'Support: {email}',
    'public.about.privacyPolicy': 'Privacy Policy',
    'public.about.termsOfService': 'Terms of Service',
    'public.privacy.title': 'Privacy Policy',
    'public.privacy.intro':
      'zalobot respects your privacy. This policy explains the data we process, why we process it, and your choices.',
    'public.privacy.dataTitle': '1. Data we process',
    'public.privacy.dataDescription':
      'To operate the bot, zalobot stores your Zalo user ID, finance and planning data you enter, and technical data required to run the service.',
    'public.privacy.scopesIntro':
      'When you choose to connect Google, we request only the following permissions:',
    'public.privacy.profileScope':
      'Basic profile information and email address to identify the connected account.',
    'public.privacy.calendarScope':
      'Google Calendar to read, create, update, or delete events that you request.',
    'public.privacy.useTitle': '2. How we use Google data',
    'public.privacy.useDescription':
      'Google data is used only to provide the Calendar and Tasks features you directly request in zalobot. We do not sell, rent, use Google data for advertising, or transfer it to third parties except infrastructure providers required to operate the service.',
    'public.privacy.policyPrefix':
      'zalobot’s use and transfer of information received from Google APIs adheres to the ',
    'public.privacy.policyLink': 'Google API Services User Data Policy',
    'public.privacy.policySuffix': ', including the Limited Use requirements.',
    'public.privacy.securityTitle': '3. Storage and security',
    'public.privacy.securityDescription':
      'Google access tokens are encrypted before storage in the database. We use reasonable technical measures to limit unauthorized access; however, no transmission or storage method is completely secure.',
    'public.privacy.retentionTitle': '4. Retention and deletion',
    'public.privacy.retentionDescription':
      'We retain data for as long as needed to provide the service or as required by law. You may request that we revoke your Google connection and delete related token/data by emailing {email} from the connected email address. We will respond within a reasonable period.',
    'public.privacy.contactTitle': '5. Contact',
    'public.privacy.contactDescription':
      'For questions about privacy or personal data, contact {email}.',
    'public.privacy.about': 'About zalobot',
    'public.terms.title': 'Terms of Service',
    'public.terms.acceptanceTitle': '1. Acceptance',
    'public.terms.acceptanceDescription':
      'By using zalobot, you agree to these terms and the Privacy Policy. If you do not agree, please do not use the service.',
    'public.terms.scopeTitle': '2. Service scope',
    'public.terms.scopeDescription':
      'zalobot is a tool for managing personal information, finances, schedules, and tasks. It does not provide professional financial, legal, or investment advice.',
    'public.terms.accountTitle': '3. Account and access',
    'public.terms.accountDescription':
      'You are responsible for commands sent from your Zalo account. Connecting Google is optional and can be revoked as described in the Privacy Policy.',
    'public.terms.legalTitle': '4. Lawful use',
    'public.terms.legalDescription':
      'You may not use zalobot to violate the law, infringe others’ rights, interfere with the service, or harm system operations.',
    'public.terms.changeTitle': '5. Service changes',
    'public.terms.changeDescription':
      'We may update the service or these terms when necessary. The latest version will be published on this page.',
    'public.terms.contactTitle': '6. Contact',
    'public.terms.contactDescription': 'Support contact: {email}.',
    'zca.directory.fetchedAt': 'Updated {time}',
    'zca.directory.fetchedAtHint':
      'Zalo contacts and groups are cached for up to 7 days. Press Refresh to fetch the latest from Zalo.',
    'zca.chatList.type': 'Type',
    'zca.chatList.listen': 'Listening',
    'zca.chatList.features': 'Features',
    'zca.chatList.access': 'Interaction access',
    'zca.chatList.actions': 'Actions',
    'zca.threadConfig.delete': '🗑️ Delete chat config',
    'zca.threadConfig.deleteConfirm':
      'Permanently delete the config of "{name}"? Zalo no longer returns this chat. Chat memory and the Drive/Photos link history are kept. This cannot be undone.',
    'zca.threadConfig.deleteSuccess': 'Deleted the config of "{name}".',
    'zca.threadConfig.deleteError': 'Could not delete the chat config. Please try again.',
    'zca.threadConfig.deleteInDirectory':
      'This chat is still in the Zalo directory, so it cannot be deleted. Stop listening to it instead, or press Refresh if the directory is out of date.',
    'zca.memberAccess.title': 'Who can call the bot in this group',
    'zca.memberAccess.description':
      'Group access adds to global access: admins and users granted on the Zalo & Users page can always use the bot.',
    'zca.memberAccess.mode.grantedUsers': 'Only globally granted users',
    'zca.memberAccess.mode.grantedUsersHint':
      'The default: an ungranted member who mentions the bot gets their User ID to send to an admin.',
    'zca.memberAccess.mode.allMembers': 'Every group member',
    'zca.memberAccess.mode.allMembersHint':
      'Anyone in the group can @mention the bot or use a prefix.',
    'zca.memberAccess.mode.selectedMembers': 'Selected members',
    'zca.memberAccess.mode.selectedMembersHint':
      'Only the members switched on below can call the bot in this group.',
    'zca.memberAccess.searchPlaceholder': 'Search by name, Zalo name or UID',
    'zca.memberAccess.filter.all': 'All',
    'zca.memberAccess.filter.selected': 'Selected',
    'zca.memberAccess.selectedCount': '{count}/{total} selected',
    'zca.memberAccess.refresh': 'Refresh list',
    'zca.memberAccess.loading': 'Loading group members…',
    'zca.memberAccess.loadError': 'Could not load the group members.',
    'zca.memberAccess.retry': 'Retry',
    'zca.memberAccess.empty': 'No matching members.',
    'zca.memberAccess.badge.admin': 'Admin',
    'zca.memberAccess.badge.global': 'Global access',
    'zca.memberAccess.badge.left': 'No longer in the group',
    'zca.memberAccess.alwaysAllowed': 'Always allowed',
    'zca.memberAccess.toggleMember': 'Let {name} call the bot in this group',
    'zca.storageLinks.driveTitle': 'Google Drive folders',
    'zca.storageLinks.photosTitle': 'Google Photos albums',
    'zca.storageLinks.description':
      'One row per Google account that has stored media for {name}. Old links stay here after the account changes.',
    'zca.storageLinks.current': 'In use',
    'zca.storageLinks.unknownAccount': 'Previous account (email unknown)',
    'zca.storageLinks.usedRange': 'Used from {from} to {to}',
    'zca.storageLinks.loading': 'Loading links…',
    'zca.storageLinks.error': 'Could not load the links. Please try again.',
    'zca.storageLinks.retry': 'Retry',
    'zca.storageLinks.empty': 'This chat has not stored any media on Google yet.',
    'zca.storageLinks.close': 'Close',
    'zca.storageLinks.openDrive': 'Show the Google Drive folders of this chat',
    'zca.storageLinks.openPhotos': 'Show the Google Photos albums of this chat',
    'zca.storageLinks.edit': 'Edit',
    'zca.storageLinks.delete': 'Delete',
    'zca.storageLinks.save': 'Save',
    'zca.storageLinks.saving': 'Saving…',
    'zca.storageLinks.cancel': 'Cancel',
    'zca.storageLinks.displayNameLabel': 'Display name',
    'zca.storageLinks.displayNamePlaceholder': 'Leave empty to use: {label}',
    'zca.storageLinks.urlLabel': 'Link',
    'zca.storageLinks.urlLockedHint':
      'The link in use is managed by the system and cannot be edited.',
    'zca.storageLinks.emailLabel': 'Google account email',
    'zca.storageLinks.emailPlaceholder': 'Leave empty if unknown',
    'zca.storageLinks.deleteConfirm':
      'Remove "{name}" from the list? The folder or album on Google is kept.',
    'zca.storageLinks.deleteCurrentDisabled':
      'The link in use cannot be deleted: new media of this chat is stored there.',
    'zca.storageLinks.saveError': 'Could not save the changes. Please try again.',
    'zca.storageLinks.deleteError': 'Could not delete the link. Please try again.',
    'zca.storageLinks.add': 'Add link',
    'zca.storageLinks.addSubmit': 'Add',
    'zca.storageLinks.adding': 'Adding…',
    'zca.storageLinks.addHint':
      'Only adds an existing link to the list: nothing is created on Google, and new media still goes to the link in use.',
    'zca.storageLinks.addError': 'Could not add the link. Please try again.',
    'zca.storageLinks.displayNameAddPlaceholder': 'Leave empty to show the link',
    'zca.storageLinks.urlPlaceholderDrive': 'https://drive.google.com/drive/folders/…',
    'zca.storageLinks.urlPlaceholderPhotos': 'https://photos.google.com/album/…',
    'zca.storageLinks.errors.displayNameTooLong':
      'The display name can have at most {max} characters.',
    'zca.storageLinks.errors.urlRequired': 'The link cannot be empty.',
    'zca.storageLinks.errors.urlInvalid': 'The link must be a valid https:// address.',
    'zca.storageLinks.errors.urlWrongHost': 'The link must be on {hosts}.',
    'zca.storageLinks.errors.urlDuplicate': 'This link is already in the list.',
    'zca.storageLinks.errors.emailInvalid': 'Invalid email.',
    'zca.googleAccount.title': 'Google storage account',
    'zca.googleAccount.description':
      'Images, videos, files and receipts of every channel are saved to this account’s Google Drive & Photos.',
    'zca.googleAccount.loading': 'Checking the Google account…',
    'zca.googleAccount.error': 'Could not load the Google account status.',
    'zca.googleAccount.retry': 'Retry',
    'zca.googleAccount.disconnected': 'Not connected',
    'zca.googleAccount.disconnectedHint': 'Channel media is not being saved to Drive and Photos.',
    'zca.googleAccount.connected': 'Connected',
    'zca.googleAccount.unknownEmail': 'Could not read the account email',
    'zca.googleAccount.missingScopes': 'Missing Drive/Photos access',
    'zca.googleAccount.missingScopesHint':
      'The account has not granted Drive and Photos access, so media cannot be saved. Grant access again.',
    'zca.googleAccount.login': 'Sign in with Google',
    'zca.googleAccount.switch': 'Switch account',
    'zca.googleAccount.regrant': 'Grant access again',
    'zca.googleAccount.logout': 'Sign out',
    'zca.googleAccount.loggingOut': 'Signing out…',
    'zca.googleAccount.openingLogin': 'Opening…',
    'zca.googleAccount.openDrive': 'Open Drive',
    'zca.googleAccount.loginHint':
      'Google sign-in opens in a new tab. Once done, come back here to see the new account.',
    'zca.googleAccount.logoutConfirm':
      'Sign out {email}? The bot stops saving media to Google until someone signs in again. Files already saved stay on Google.',
    'zca.googleAccount.loginError': 'Could not create the Google sign-in link. Please try again.',
    'zca.googleAccount.logoutError': 'Google sign-out failed. Please try again.',
    'zca.googleAccount.logoutTitle': 'Sign out of the Google storage account?',
  },
} as const;

export type TranslationKey = keyof (typeof messages)['vi'];
const typedMessages: Record<SupportedLocale, Record<TranslationKey, string>> = messages;

export function translate(
  locale: SupportedLocale,
  key: TranslationKey,
  values: TranslationValues = {},
): string {
  let text: string = typedMessages[locale]?.[key] ?? typedMessages[DEFAULT_LOCALE][key] ?? key;
  for (const [name, value] of Object.entries(values))
    text = text.replaceAll(`{${name}}`, String(value));
  return text;
}

export interface IApiResponse<T> {
  data: T;
}

export interface IApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  requestId?: string;
}

export interface IDashboardAccessTokenResponse {
  accessToken: string;
  expiresAt: string;
}

/** Sign-in code sent by the bot next to the one-time link, for the installed app (PWA). */
export interface IDashboardAccessCodeRequest {
  code: string;
}

/** Longest code the API reads, so oversized input is rejected before hashing. */
export const DASHBOARD_ACCESS_CODE_MAX_LENGTH = 32;

/** Drops spaces/dashes so `1234-5678` and `12345678` are the same code. */
export function normalizeDashboardAccessCode(raw: string): string {
  return raw.replace(/[\s-]/g, '');
}

/** A normalized code: digits only, no fixed length. */
export function isDashboardAccessCode(value: string): boolean {
  return value.length <= DASHBOARD_ACCESS_CODE_MAX_LENGTH && /^\d+$/.test(value);
}

export interface IContactListItem {
  id: string;
  displayName: string;
  alias?: string;
  descriptor?: string;
  phoneNumber?: string;
  bankAccountNumber?: string;
  bankCode?: string;
  bankName?: string;
  avatarUrl?: string;
  linkedUserId?: string;
  linkedUser?: {
    id: string;
    username?: string;
    firstName?: string;
    avatarUrl?: string;
    /** Số lưu trên tài khoản User; khác `phoneNumber` của liên hệ thì UI hiện chỉ báo lệch số. */
    phoneNumber?: string;
  };
  debtCount?: number;
  transactionCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface IDebtPaymentItem {
  id: string;
  debtId: string;
  financeTransactionId?: string;
  amount: number;
  paymentDate: string;
  note?: string;
  createdAt: string;
}

export interface IDebtAllocationItem {
  id: string;
  financeTransactionId: string;
  debtId: string;
  amount: number;
  allocatedAt: string;
  note?: string;
  createdAt: string;
  debt?: {
    counterparty: string;
    counterpartyAlias?: string;
    direction: DebtDirection;
    remainingAmount: number;
    originalAmount: number;
  };
}

export interface ICandidateDebtItem {
  id: string;
  direction: DebtDirection;
  counterparty: string;
  counterpartyAlias?: string;
  contactId?: string;
  originalAmount: number;
  remainingAmount: number;
  currentAllocatedAmount: number;
  note?: string;
  occurredAt: string;
  dueAt?: string;
  status: 'active' | 'settled';
}

export interface IAllocateTransactionRequest {
  allocations: Array<{
    debtId: string;
    amount: number;
    note?: string;
  }>;
}

export interface IAllocateTransactionResponse {
  allocations: IDebtAllocationItem[];
  remainingUnallocated: number;
}

export interface ICreateDebtPaymentRequest {
  debtId: string;
  amount: number;
  paymentDate?: string;
  note?: string;
}

export interface IDebtListItem {
  id: string;
  direction: 'receivable' | 'payable';
  counterparty: string;
  counterpartyAlias?: string;
  contactId?: string;
  parentDebtId?: string | null;
  originalAmount: number;
  remainingAmount: number;
  status?: 'active' | 'settled';
  currency?: string;
  note?: string;
  occurredAt: string;
  dueAt?: string;
  settledAt?: string;
  payments?: IDebtPaymentItem[];
  children?: IDebtListItem[];
  childCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface IExpenseListItem {
  id: string;
  category: string;
  note: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
  receiptUrl?: string;
  contactId?: string;
  placeId?: string;
  placeName?: string;
  occurredAt: string;
  updatedAt?: string;
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export enum GrantAccessStatus {
  DENIED = 0,
  GRANTED = 1,
}

export interface IUserListItem {
  id: string;
  username?: string;
  firstName?: string;
  displayName?: string;
  role: UserRole;
  grantAccess: GrantAccessStatus;
  status: 'active' | 'suspended';
  avatarUrl?: string;
  phoneNumber?: string;
  alias?: string;
  zaloName?: string;
  /** Số Người liên quan (trong mọi danh bạ công nợ) đang liên kết tới user này. */
  linkedContactCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface IUserLinkedContactItem {
  contactId: string;
  displayName: string;
  alias?: string;
  debtCount: number;
  createdAt: string;
}

export const USER_MERGE_TABLES = [
  'financeTransactions',
  'debtContacts',
  'reminders',
  'googleToken',
] as const;

export type UserMergeTable = (typeof USER_MERGE_TABLES)[number];

export type UserMergeGoogleTokenDecision = 'keep-source' | 'keep-target' | 'none';

export interface IUserMergeRequest {
  targetUserId: string;
}

export interface IUserMergeConflicts {
  /** Source contact links dropped because the target already links to a contact. */
  linkedContacts: number;
  googleToken: UserMergeGoogleTokenDecision;
}

export interface IUserMergeSummary {
  sourceUserId: string;
  targetUserId: string;
  counts: Record<UserMergeTable, number>;
  conflicts: IUserMergeConflicts;
  sourceIsBotAccount: boolean;
}

export interface IUserMergeResult extends IUserMergeSummary {
  sourceWasCurrentSession: boolean;
}

/** Who the dashboard session belongs to (`GET API_ROUTES.sessionMe`). */
export interface IDashboardSessionUser {
  /** `users.id` of the session. */
  id: string;
  /** Zalo name; null when unknown (and for the dashboard owner, which has no Zalo account). */
  name: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  /** Signed in with `DASHBOARD_LOGIN_CODE`. */
  isDashboardOwner: boolean;
}

export interface IDashboardData {
  user: { name: string; isAdmin: boolean; googleConnected: boolean };
  finance: {
    income: number;
    expense: number;
    balance: number;
    ledgerBalance: number;
    receivable: number;
    payable: number;
  };
  transactions: Array<{
    id: string;
    type: 'income' | 'expense';
    category: string;
    note: string;
    amount: number;
    currency?: string;
    paymentMethod?: string;
    placeId?: string;
    placeName?: string;
    occurredAt: string;
  }>;
  debts: IDebtListItem[];
  calendar: ICalendarEventItem[];
  tasks: ITaskListItem[];
  reminders: IReminderListItem[];
  activity: Array<{ id: string; action: AuditAction; tableName: string; createdAt: string }>;
  admin?: { userCount: number; googleConnectedCount: number };
}

/**
 * Where the Google copy of a calendar event stands. The record itself always lives
 * in the DB; `local` means it never reached Google (no account connected when written).
 */
export type GoogleSyncStatus = 'synced' | 'pending' | 'failed' | 'local';
export type CalendarSyncStatus = GoogleSyncStatus;

export type CalendarEventSource = 'zalo' | 'dashboard' | 'google';

export interface IGoogleCopySync {
  status: GoogleSyncStatus;
  /** Google account holding the copy; absent when the record never reached Google. */
  accountEmail?: string;
  /** False when the copy sits in a Google account the system is no longer connected to. */
  isCurrentAccount: boolean;
  syncedAt?: string;
}
export type ICalendarEventSync = IGoogleCopySync;

export interface ICalendarEventItem {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startAt?: string;
  /** Exclusive end; for all-day events this is midnight after the last day, as in Google. */
  endAt?: string;
  timeZone?: string;
  allDay?: boolean;
  reminderMinutes?: number[];
  createdByUserId?: string;
  createdByName?: string;
  source?: CalendarEventSource;
  sourceChatName?: string;
  sourceChatType?: 'user' | 'group';
  sync?: ICalendarEventSync;
  createdAt?: string;
}

export interface ICalendarEventsQuery {
  timeMin: string;
  timeMax: string;
  query?: string;
}

export interface IUpdateCalendarEventRequest {
  summary?: string;
  description?: string;
  startDateTime?: string;
  endDateTime?: string;
  location?: string;
  timeZone?: string;
  allDay?: boolean;
  reminderMinutes?: number[];
}

export interface ICreateCalendarEventRequest {
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  location?: string;
  timeZone?: string;
  allDay?: boolean;
  reminderMinutes?: number[];
}

export interface IReminderListItem {
  id: string;
  title: string;
  remindAt: string;
  notifyType: 'text' | 'call';
  /** Legacy: the repeat of the earliest time. Each time carries its own (`remindTimes`). */
  repeatType?: ReminderRepeatType;
  /** Remind again every this many minutes after each time, `nagCount` times; absent = never. */
  nagEveryMinutes?: number;
  nagCount?: number;
  status?: 'pending' | 'completed' | 'snoozed' | 'cancelled';
  snoozeCount?: number;
  snoozedUntil?: string;
  /** Chat the reminder goes to; absent on old rows = the owner's private chat. */
  chatId?: string;
  chatName?: string;
  remindUsers?: IReminderTargetUser[];
  remindMode?: ReminderTargetMode;
  /** Every time of the reminder, earliest first; `remindAt` is the next one. */
  remindTimes?: IReminderTime[];
  /** When the reminder finished (last time sent, or marked done); absent while upcoming. */
  completedAt?: string;
}

/**
 * Which reminders `GET /api/reminders?status=` lists: `upcoming` (default) still has a time
 * to send; `done` has none left or was marked done, and is kept until deleted.
 */
export const REMINDER_LIST_STATUSES = ['upcoming', 'done'] as const;
export type ReminderListStatus = (typeof REMINDER_LIST_STATUSES)[number];
/** The `done` list returns the most recent ones only (no paging yet). */
export const REMINDER_LIST_LIMITS = { DONE_MAX: 200 } as const;

export function isReminderListStatus(value: unknown): value is ReminderListStatus {
  return typeof value === 'string' && (REMINDER_LIST_STATUSES as readonly string[]).includes(value);
}

export interface IUpdateReminderRequest {
  title?: string;
  remindAt?: string;
  notifyType?: 'text' | 'call';
  /** Legacy: the repeat of every time given as a plain ISO string. */
  repeatType?: ReminderRepeatType;
  /** `null` turns reminding again off. */
  nagEveryMinutes?: number | null;
  nagCount?: number | null;
  status?: 'pending' | 'completed' | 'snoozed' | 'cancelled';
  snoozeCount?: number;
  snoozedUntil?: string;
  /** Replaces the times; times already on the reminder keep whether they were sent. */
  remindTimes?: ReminderTimeRequest[];
  chatId?: string;
  /** Members of the reminder group to remind; `[]` clears them. */
  remindUserIds?: string[];
  remindMode?: ReminderTargetMode;
}

export interface IUpdateTransactionRequest {
  type?: TransactionType;
  category?: string;
  note?: string;
  amount?: number;
  currency?: string;
  paymentMethod?: string;
  receiptUrl?: string;
  contactId?: string;
  placeId?: string | null;
  placeName?: string;
  occurredAt?: string;
}

export interface IUpdateExpenseRequest {
  category?: string;
  note?: string;
  amount?: number;
  currency?: string;
  paymentMethod?: string;
  receiptUrl?: string;
  contactId?: string;
  placeId?: string | null;
  placeName?: string;
  occurredAt?: string;
}

/** `POST /api/debts`: needs either `contactId` or `createNewContact: true`, otherwise the API rejects it. */
export interface ICreateDebtRequest {
  direction: 'receivable' | 'payable';
  counterparty: string;
  counterpartyAlias?: string;
  contactId?: string;
  createNewContact?: boolean;
  amount: number;
  note?: string;
  occurredAt?: string;
  dueAt?: string;
}

export interface IUpdateDebtRequest {
  direction?: 'receivable' | 'payable';
  counterparty?: string;
  counterpartyAlias?: string;
  contactId?: string;
  originalAmount?: number;
  remainingAmount?: number;
  amount?: number;
  currency?: string;
  note?: string;
  occurredAt?: string;
  dueAt?: string;
}

export type TaskStatus = 'needsAction' | 'completed';

export type TaskSource = 'zalo' | 'dashboard';

/** A task of the shared task list. It lives only in the zalobot DB. */
export interface ITaskListItem {
  id: string;
  title: string;
  notes?: string;
  dueAt?: string;
  status?: TaskStatus;
  updatedAt?: string;
  completedAt?: string;
  createdByUserId?: string;
  createdByName?: string;
  source?: TaskSource;
  sourceChatName?: string;
  sourceChatType?: 'user' | 'group';
  createdAt?: string;
  /** The next reminder time not sent yet, else the latest one; only open tasks are reminded. */
  remindAt?: string;
  /** Every reminder time of the task, earliest first. */
  remindTimes?: IReminderTime[];
  remindChatId?: string;
  remindChatName?: string;
  remindUsers?: IReminderTargetUser[];
  remindMode?: ReminderTargetMode;
  /** Set once the reminder went out (or was skipped); cleared when the time or target changes. */
  remindedAt?: string;
  /** Remind again every this many minutes after each time, `nagCount` times; absent = never. */
  nagEveryMinutes?: number;
  nagCount?: number;
}

export interface IUpdateTaskRequest {
  title?: string;
  /** Empty string clears it. */
  notes?: string;
  /** ISO date-time; empty string clears it. */
  due?: string;
  status?: TaskStatus;
  /** One ISO time (same as `remindTimes: [remindAt]`); empty string clears every reminder. */
  remindAt?: string;
  /** Replaces the reminder times; times already on the task keep whether they were sent. */
  remindTimes?: ReminderTimeRequest[];
  remindChatId?: string;
  /** Members of the reminder group to remind; `[]` clears them. */
  remindUserIds?: string[];
  remindMode?: ReminderTargetMode;
  /** `null` turns reminding again off. */
  nagEveryMinutes?: number | null;
  nagCount?: number | null;
}

export interface ICreateTaskRequest {
  title: string;
  notes?: string;
  due?: string;
  remindAt?: string;
  /** Up to `REMINDER_TIME_LIMITS.MAX_TIMES` times; wins over `remindAt`. */
  remindTimes?: ReminderTimeRequest[];
  /** Required with `remindAt` unless the dashboard user has a Zalo account (then their private chat). */
  remindChatId?: string;
  remindUserIds?: string[];
  remindMode?: ReminderTargetMode;
  nagEveryMinutes?: number;
  nagCount?: number;
}

/**
 * How a reminder with chosen people goes out: one message in the group tagging them
 * (`mention`), or a private message to each of them (`direct`).
 */
export type ReminderTargetMode = 'mention' | 'direct';
export const REMINDER_TARGET_MODES: readonly ReminderTargetMode[] = ['mention', 'direct'];
export const REMINDER_TARGET_LIMITS = { MAX_USERS: 10 } as const;

/** A task or a reminder can remind several times; each time is sent once, or repeats. */
export const REMINDER_TIME_LIMITS = { MAX_TIMES: 10 } as const;

export interface IReminderTime {
  id: string;
  /** The next occurrence of a repeating time, else the time itself. */
  remindAt: string;
  /** Set once this time went out (or was skipped); never set on a repeating time. */
  sentAt?: string;
  /** How this time repeats; absent = once. */
  repeatType?: ReminderRepeatType;
  /** Weekdays of a `weekly` repeat, 0 = Sunday (Vietnam time); empty = the time's weekday. */
  repeatWeekdays?: number[];
}

/** One requested time with how it repeats. */
export interface IReminderTimeInput {
  remindAt: string;
  /** Absent: once for a new time, unchanged for a time already saved. */
  repeatType?: ReminderRepeatType;
  repeatWeekdays?: number[];
}

/** A requested time: a plain ISO string (older callers) or a time with its repeat. */
export type ReminderTimeRequest = string | IReminderTimeInput;

/** A Zalo user to remind, with the name shown in the `@name` tag. */
export interface IReminderTargetUser {
  id: string;
  name: string;
}

/** A Zalo chat that can receive reminders: a listened thread, or the user's own private chat. */
export interface IReminderTargetChannel {
  id: string;
  name: string;
  type: 'user' | 'group';
  isSelf?: boolean;
}

export interface IContactListResponse {
  contacts: IContactListItem[];
}

export type TransactionType = 'income' | 'expense';

export const DEFAULT_INCOME_CATEGORIES = [
  'Lương',
  'Thưởng',
  'Đầu tư',
  'Thu nợ',
  'Kinh doanh',
  'Quà tặng',
  'Điều chỉnh số dư',
  'Khác',
] as const;

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Ăn uống',
  'Di chuyển',
  'Mua sắm',
  'Hóa đơn & Tiện ích',
  'Giải trí',
  'Nhà cửa',
  'Sức khỏe',
  'Giáo dục',
  'Gia đình',
  'Điều chỉnh số dư',
  'Khác',
] as const;

export type DebtDirection = 'receivable' | 'payable';
export type ReminderNotifyType = 'text' | 'call';
/**
 * How each time of a task or a reminder repeats: `weekdays` = Monday to Friday, `weekly` = on
 * `repeatWeekdays` (or the weekday of the time), `monthly` = on the day of the month of the
 * time (the last day in shorter months), `yearly` = on the day and month of the time (28
 * February for 29 February outside leap years; solar calendar only). Missed occurrences are
 * not sent late.
 */
export type ReminderRepeatType = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly';
export const REMINDER_REPEAT_TYPES: readonly ReminderRepeatType[] = [
  'none',
  'daily',
  'weekdays',
  'weekly',
  'monthly',
  'yearly',
];

export function isReminderRepeatType(value: unknown): value is ReminderRepeatType {
  return typeof value === 'string' && (REMINDER_REPEAT_TYPES as readonly string[]).includes(value);
}

/** "Remind again": after each time, every 5 minutes to 24 hours, 1 to 10 more times. */
export const REMINDER_NAG_LIMITS = {
  MIN_EVERY_MINUTES: 5,
  MAX_EVERY_MINUTES: 1440,
  MAX_COUNT: 10,
} as const;
export const REMINDER_NAG_EVERY_OPTIONS = [5, 10, 15, 30, 60, 120] as const;

/**
 * The rule one reminder time follows: its own repeat, and the remind-again setting of its task
 * or reminder (shared by all of its times).
 */
export interface IReminderRule {
  repeatType: ReminderRepeatType;
  /** 0 = Sunday … 6 = Saturday (Vietnam time); only read for `weekly`. */
  repeatWeekdays: readonly number[];
  /** Both set, or both null (no reminding again). */
  nagEveryMinutes: number | null;
  nagCount: number | null;
}

export type ReminderRuleError = 'nagEvery' | 'nagCount' | 'nagTooLong' | 'weekdays';

const DAY_MINUTES = 24 * 60;

/** Shortest gap between two occurrences of a repeat, in minutes; null without a repeat. */
export function shortestRepeatGapMinutes(
  repeatType: ReminderRepeatType,
  weekdays: readonly number[],
): number | null {
  switch (repeatType) {
    case 'none':
      return null;
    case 'daily':
    case 'weekdays':
      return DAY_MINUTES;
    case 'monthly':
      return 28 * DAY_MINUTES;
    case 'yearly':
      return 365 * DAY_MINUTES;
    case 'weekly': {
      const days = [...new Set(weekdays)].sort((a, b) => a - b);
      if (days.length <= 1) return 7 * DAY_MINUTES;
      // Gaps between picked days, including the wrap from the last one to next week's first.
      const gaps = days.map((day, i) =>
        i === 0 ? days[0] + 7 - days[days.length - 1] : day - days[i - 1],
      );
      return Math.min(...gaps) * DAY_MINUTES;
    }
  }
}

/**
 * Checks a rule: reminding again needs both values in range, and must be over before the next
 * repeat (otherwise its last reminders would land after the next occurrence).
 */
export function validateReminderRule(rule: IReminderRule): ReminderRuleError | null {
  const days = rule.repeatWeekdays;
  if (days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) return 'weekdays';
  const { nagEveryMinutes: every, nagCount: count } = rule;
  if (every === null && count === null) return null;
  if (
    every === null ||
    !Number.isInteger(every) ||
    every < REMINDER_NAG_LIMITS.MIN_EVERY_MINUTES ||
    every > REMINDER_NAG_LIMITS.MAX_EVERY_MINUTES
  ) {
    return 'nagEvery';
  }
  if (
    count === null ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > REMINDER_NAG_LIMITS.MAX_COUNT
  ) {
    return 'nagCount';
  }
  const gap = shortestRepeatGapMinutes(rule.repeatType, rule.repeatType === 'weekly' ? days : []);
  return gap !== null && every * count >= gap ? 'nagTooLong' : null;
}

export interface ITransactionItem {
  id: string;
  type: TransactionType;
  category: string;
  note: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
  placeId?: string;
  placeName?: string;
  occurredAt: string;
  createdAt?: string;
  /** Who recorded it (Zalo sender or dashboard user); display only, finance data is shared. */
  createdByUserId?: string;
  createdByName?: string;
  source?: TransactionSource;
  /** Zalo chat the message came from (thread name from ZCA config when known). */
  sourceChatName?: string;
  sourceChatType?: 'user' | 'group';
  /** A receipt image can be viewed at `API_ROUTES.transactionReceipt(id)`. */
  hasReceipt?: boolean;
  allocations?: Array<{
    id: string;
    amount: number;
    debtId: string;
    note?: string;
    counterparty?: string;
    remainingAmount?: number;
  }>;
}

export type TransactionSource = 'zalo' | 'dashboard';

/** `placeIds` entry selecting transactions without a place. */
export const TRANSACTION_FILTER_NO_PLACE = 'none';

export interface ITransactionListQuery {
  type?: TransactionType;
  startAt?: string;
  endAt?: string;
  search?: string;
  /** Exact category names (OR). */
  categories?: string[];
  /** Note contains (case-insensitive). */
  note?: string;
  /** Place ids (OR); `TRANSACTION_FILTER_NO_PLACE` matches rows without a place. */
  placeIds?: string[];
  /** Creator user ids (OR). */
  createdByUserIds?: string[];
  hasReceipt?: boolean;
  amountMin?: number;
  amountMax?: number;
  limit?: number;
  offset?: number;
}

export interface ITransactionCreatorFacet {
  id: string;
  /** Empty when neither the user profile nor the transaction snapshot has a name. */
  name: string;
}

export interface ITransactionListItem extends ITransactionItem {
  /** Wallet balance right after this transaction, over the whole shared ledger (filter-independent). */
  runningBalance: number;
}

export interface ITransactionListResponse {
  items: ITransactionListItem[];
  total: number;
  limit: number;
  offset: number;
  /** Totals over the whole period (ignores type/search and pagination). */
  summary: { income: number; expense: number; count: number };
  /** All-time income minus expense. */
  ledgerBalance: number;
  /** Filter options over the whole period (ignores type/search/column filters). */
  facets: { creators: ITransactionCreatorFacet[]; categories: string[] };
}

export interface ICreateTransactionRequest {
  type: TransactionType;
  amount: number;
  note: string;
  category?: string;
  currency?: string;
  paymentMethod?: string;
  receiptUrl?: string;
  contactId?: string;
  placeId?: string;
  placeName?: string;
  occurredAt?: string;
}

export interface ICreateReminderRequest {
  title: string;
  /** One ISO time; give it or `remindTimes`. */
  remindAt?: string;
  /** Up to `REMINDER_TIME_LIMITS.MAX_TIMES` times; wins over `remindAt`. */
  remindTimes?: ReminderTimeRequest[];
  notifyType?: ReminderNotifyType;
  /** Legacy: the repeat of every time given as a plain ISO string. */
  repeatType?: ReminderRepeatType;
  nagEveryMinutes?: number;
  nagCount?: number;
  /** Defaults to the creator's private chat; required for `dashboard-owner`. */
  chatId?: string;
  remindUserIds?: string[];
  remindMode?: ReminderTargetMode;
  status?: 'pending' | 'completed' | 'snoozed' | 'cancelled';
  snoozeCount?: number;
  snoozedUntil?: string;
}

export interface IUpdateContactRequest {
  displayName: string;
  alias?: string;
  descriptor?: string;
  phoneNumber?: string;
  bankAccountNumber?: string;
  bankCode?: string;
  bankName?: string;
  avatarUrl?: string;
  linkedUserId?: string | null;
}

/** Quan hệ của người dùng với một Người liên quan (hiển thị trên Hồ sơ). */
export const CONTACT_RELATIONSHIPS = ['family', 'friend', 'colleague', 'partner', 'other'] as const;
export type ContactRelationship = (typeof CONTACT_RELATIONSHIPS)[number];

export function isContactRelationship(value: unknown): value is ContactRelationship {
  return typeof value === 'string' && (CONTACT_RELATIONSHIPS as readonly string[]).includes(value);
}

/** Số điện thoại phụ; số chính vẫn là `phoneNumber` của Người liên quan. */
export interface IContactPhoneEntry {
  value: string;
  label?: string;
}

/** Tài khoản ngân hàng phụ; tài khoản chính vẫn là `bankAccountNumber` / `bankName`. */
export interface IContactBankAccountEntry {
  accountNumber: string;
  bankName?: string;
  bankCode?: string;
  label?: string;
}

/** Các trường chỉ có trên Hồ sơ (lưu trên `debt_contacts`). */
export interface IContactProfileFields {
  notes: string | null;
  /** `YYYY-MM-DD`. */
  birthday: string | null;
  address: string | null;
  workplace: string | null;
  relationship: ContactRelationship | null;
  extraPhones: IContactPhoneEntry[];
  extraBankAccounts: IContactBankAccountEntry[];
}

/** Người dùng Zalo đã gắn với Người liên quan; `role` / `grantAccess` chỉ trả cho admin. */
export interface IContactProfileLinkedUser {
  id: string;
  username?: string;
  firstName?: string;
  avatarUrl?: string;
  phoneNumber?: string;
  role?: UserRole;
  grantAccess?: GrantAccessStatus;
}

export interface IContactProfile
  extends
    Omit<IContactListItem, 'linkedUser' | 'debtCount' | 'transactionCount'>,
    IContactProfileFields {
  linkedUser?: IContactProfileLinkedUser;
}

/**
 * Số liệu tính trên toàn bộ khoản nợ gốc và giao dịch của Người liên quan. Giao dịch = gắn với
 * Người liên quan (`contact_id`) hoặc do tài khoản Zalo đã liên kết ghi (`created_by_user_id`),
 * mỗi dòng tính một lần.
 */
export interface IContactProfileSummary {
  receivableRemaining: number;
  payableRemaining: number;
  openDebtCount: number;
  debtCount: number;
  incomeTotal: number;
  expenseTotal: number;
  transactionCount: number;
}

/**
 * `GET /api/contacts/:id/profile`. `recentTransactions` (cùng phạm vi giao dịch với `summary`)
 * giới hạn `CONTACT_PROFILE_LIMITS.RECENT_TRANSACTIONS`.
 */
export interface IContactProfileResponse {
  contact: IContactProfile;
  summary: IContactProfileSummary;
  debts: IDebtListItem[];
  recentTransactions: ITransactionItem[];
}

/** `PATCH /api/contacts/:id/profile`: trường không gửi = giữ nguyên, `null` / rỗng = xoá. */
export interface IUpdateContactProfileRequest {
  notes?: string | null;
  birthday?: string | null;
  address?: string | null;
  workplace?: string | null;
  relationship?: ContactRelationship | null;
  extraPhones?: IContactPhoneEntry[];
  extraBankAccounts?: IContactBankAccountEntry[];
}

export const CONTACT_PROFILE_LIMITS = {
  NOTES_MAX_LENGTH: 5000,
  TEXT_MAX_LENGTH: 200,
  LABEL_MAX_LENGTH: 40,
  MAX_EXTRA_ITEMS: 10,
  PHONE_MIN_DIGITS: 8,
  PHONE_MAX_DIGITS: 15,
  BANK_ACCOUNT_MIN_DIGITS: 6,
  BANK_ACCOUNT_MAX_DIGITS: 20,
  RECENT_TRANSACTIONS: 50,
} as const;

export type ContactProfileUpdateErrorCode =
  | 'text_too_long'
  | 'notes_too_long'
  | 'birthday_invalid'
  | 'birthday_future'
  | 'relationship_invalid'
  | 'list_invalid'
  | 'too_many_items'
  | 'label_too_long'
  | 'phone_invalid'
  | 'bank_account_invalid';

export interface ContactProfileUpdateError {
  code: ContactProfileUpdateErrorCode;
  /** Dòng lỗi trong danh sách SĐT / tài khoản phụ. */
  index?: number;
}

export type ContactProfileUpdateErrors = Partial<
  Record<keyof IUpdateContactProfileRequest, ContactProfileUpdateError>
>;

/** Chỉ giữ chữ số; dùng để so trùng SĐT / số tài khoản. */
export function contactDigits(value: string): string {
  return value.replace(/\D/g, '');
}

type ProfileTextResult = { value: string | null } | { error: ContactProfileUpdateErrorCode };

function profileText(
  raw: unknown,
  max: number,
  tooLong: ContactProfileUpdateErrorCode,
): ProfileTextResult {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (value.length > max) return { error: tooLong };
  return { value: value || null };
}

function profileLabel(raw: unknown): string | undefined | false {
  const label = typeof raw === 'string' ? raw.trim() : '';
  if (label.length > CONTACT_PROFILE_LIMITS.LABEL_MAX_LENGTH) return false;
  return label || undefined;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function profileEntries(raw: unknown): Map<string, unknown>[] | null {
  if (!Array.isArray(raw)) return null;
  const items: unknown[] = raw;
  const entries: Map<string, unknown>[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) return null;
    entries.push(new Map<string, unknown>(Object.entries(item)));
  }
  return entries;
}

function validatePhoneList(
  raw: unknown,
): { value: IContactPhoneEntry[] } | { error: ContactProfileUpdateError } {
  const entries = profileEntries(raw);
  if (!entries) return { error: { code: 'list_invalid' } };
  const result: IContactPhoneEntry[] = [];
  const seen = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    const rawValue = entry.get('value');
    const value = typeof rawValue === 'string' ? rawValue.trim().replace(/\s+/g, ' ') : '';
    const label = profileLabel(entry.get('label'));
    if (!value && !label) continue;
    const digits = contactDigits(value);
    if (
      !/^[+\d\s.-]+$/.test(value) ||
      digits.length < CONTACT_PROFILE_LIMITS.PHONE_MIN_DIGITS ||
      digits.length > CONTACT_PROFILE_LIMITS.PHONE_MAX_DIGITS
    ) {
      return { error: { code: 'phone_invalid', index } };
    }
    if (label === false) return { error: { code: 'label_too_long', index } };
    if (seen.has(digits)) continue;
    seen.add(digits);
    result.push(label ? { value, label } : { value });
  }
  if (result.length > CONTACT_PROFILE_LIMITS.MAX_EXTRA_ITEMS) {
    return { error: { code: 'too_many_items' } };
  }
  return { value: result };
}

function validateBankAccountList(
  raw: unknown,
): { value: IContactBankAccountEntry[] } | { error: ContactProfileUpdateError } {
  const entries = profileEntries(raw);
  if (!entries) return { error: { code: 'list_invalid' } };
  const result: IContactBankAccountEntry[] = [];
  const seen = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    const rawNumber = entry.get('accountNumber');
    const accountNumber = typeof rawNumber === 'string' ? contactDigits(rawNumber) : '';
    const bankName = profileText(
      entry.get('bankName'),
      CONTACT_PROFILE_LIMITS.TEXT_MAX_LENGTH,
      'text_too_long',
    );
    const bankCode = profileText(
      entry.get('bankCode'),
      CONTACT_PROFILE_LIMITS.LABEL_MAX_LENGTH,
      'text_too_long',
    );
    const label = profileLabel(entry.get('label'));
    const hasText = 'value' in bankName && bankName.value !== null;
    if (!accountNumber && !hasText && !label) continue;
    if (
      accountNumber.length < CONTACT_PROFILE_LIMITS.BANK_ACCOUNT_MIN_DIGITS ||
      accountNumber.length > CONTACT_PROFILE_LIMITS.BANK_ACCOUNT_MAX_DIGITS
    ) {
      return { error: { code: 'bank_account_invalid', index } };
    }
    if ('error' in bankName || 'error' in bankCode) {
      return { error: { code: 'text_too_long', index } };
    }
    if (label === false) return { error: { code: 'label_too_long', index } };
    if (seen.has(accountNumber)) continue;
    seen.add(accountNumber);
    result.push({
      accountNumber,
      ...(bankName.value ? { bankName: bankName.value } : {}),
      ...(bankCode.value ? { bankCode: bankCode.value.toUpperCase() } : {}),
      ...(label ? { label } : {}),
    });
  }
  if (result.length > CONTACT_PROFILE_LIMITS.MAX_EXTRA_ITEMS) {
    return { error: { code: 'too_many_items' } };
  }
  return { value: result };
}

/**
 * Kiểm tra và chuẩn hoá một lần sửa Hồ sơ (API và form web dùng chung): trim, chuỗi rỗng thành
 * `null`, bỏ dòng trống và dòng trùng trong danh sách phụ. `today` là `YYYY-MM-DD` để chặn ngày sinh
 * ở tương lai.
 */
export function validateContactProfileUpdate(
  input: unknown,
  today: string = new Date().toISOString().slice(0, 10),
):
  | { ok: true; value: IUpdateContactProfileRequest }
  | { ok: false; errors: ContactProfileUpdateErrors } {
  const fields =
    typeof input === 'object' && input !== null
      ? new Map<string, unknown>(Object.entries(input))
      : new Map<string, unknown>();
  const value: IUpdateContactProfileRequest = {};
  const errors: ContactProfileUpdateErrors = {};

  if (fields.has('notes')) {
    const notes = profileText(
      fields.get('notes'),
      CONTACT_PROFILE_LIMITS.NOTES_MAX_LENGTH,
      'notes_too_long',
    );
    if ('error' in notes) errors.notes = { code: notes.error };
    else value.notes = notes.value;
  }
  for (const key of ['address', 'workplace'] as const) {
    if (!fields.has(key)) continue;
    const text = profileText(
      fields.get(key),
      CONTACT_PROFILE_LIMITS.TEXT_MAX_LENGTH,
      'text_too_long',
    );
    if ('error' in text) errors[key] = { code: text.error };
    else value[key] = text.value;
  }
  if (fields.has('birthday')) {
    const raw = fields.get('birthday');
    const birthday = typeof raw === 'string' ? raw.trim() : '';
    if (!birthday) value.birthday = null;
    else if (!isValidIsoDate(birthday)) errors.birthday = { code: 'birthday_invalid' };
    else if (birthday > today) errors.birthday = { code: 'birthday_future' };
    else value.birthday = birthday;
  }
  if (fields.has('relationship')) {
    const raw = fields.get('relationship');
    if (raw === null || raw === '') value.relationship = null;
    else if (isContactRelationship(raw)) value.relationship = raw;
    else errors.relationship = { code: 'relationship_invalid' };
  }
  if (fields.has('extraPhones')) {
    const phones = validatePhoneList(fields.get('extraPhones'));
    if ('error' in phones) errors.extraPhones = phones.error;
    else value.extraPhones = phones.value;
  }
  if (fields.has('extraBankAccounts')) {
    const accounts = validateBankAccountList(fields.get('extraBankAccounts'));
    if ('error' in accounts) errors.extraBankAccounts = accounts.error;
    else value.extraBankAccounts = accounts.value;
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value };
}

export interface IContactUserSyncSuggestion {
  userId: string;
  userName: string;
  contactId: string;
  contactName: string;
}

/** Kết quả đưa người dùng Zalo vào danh bạ công nợ của admin (`POST /api/contacts/sync-users`). */
export interface IContactUserSyncResult {
  created: number;
  phoneFilled: number;
  /** User trùng tên với liên hệ chưa gắn: không tự tạo/tự gắn, để admin xác nhận. */
  suggestions: IContactUserSyncSuggestion[];
}

export interface ICombineContactsRequest {
  targetContactId?: string;
  sourceContactIds?: string[];
  contactIds?: string[];
  displayName?: string;
  alias?: string;
  descriptor?: string;
  linkedUserId?: string | null;
  consolidateDebts?: boolean;
}

export interface ICombineContactsResponse {
  targetContact: IContactListItem;
  affectedDebtsCount: number;
  affectedTransactionsCount: number;
  mergedCount: number;
}

export interface ICombineDebtsRequest {
  debtIds: string[];
  counterparty?: string;
  counterpartyAlias?: string;
  contactId?: string;
  note?: string;
  dueAt?: string;
}

export interface ICombineDebtsResponse {
  parentDebt: IDebtListItem;
  mergedDebtsCount: number;
}

export interface ICategoryItem {
  id: string;
  type: 'income' | 'expense';
  name: string;
  color?: string;
  icon?: string;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface IFinancePlace {
  id: string;
  name: string;
  transactionCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ICreatePlaceRequest {
  name: string;
}

export interface IUpdatePlaceRequest {
  name: string;
}

export interface ICombinePlacesRequest {
  placeIds: string[];
  targetPlaceId?: string;
  name?: string;
}

export interface ICombinePlacesResponse {
  leadPlace: IFinancePlace;
  mergedPlacesCount: number;
  affectedTransactionsCount: number;
}

export interface ICreateCategoryRequest {
  type: 'income' | 'expense';
  name: string;
  color?: string;
  icon?: string;
}

export interface IUpdateCategoryRequest {
  name?: string;
  color?: string;
  icon?: string;
}

export interface ICategoryListResponse {
  categories: ICategoryItem[];
}

export type AnalyticsGrain = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all';

export interface IFinanceAnalyticsSummary {
  income: number;
  expense: number;
  balance: number;
  netSavingsRate: number;
  receivableTotal: number;
  payableTotal: number;
}

export interface IAnalyticsTrendBucket {
  key: string;
  label: string;
  income: number;
  expense: number;
  netCashflow: number;
  balance: number;
  startAt: string;
  endAt: string;
}

export interface IAnalyticsCategoryBreakdown {
  category: string;
  type: 'expense' | 'income';
  amount: number;
  count: number;
  percentage: number;
  color?: string;
}

export interface IAnalyticsDebtBreakdown {
  receivable: number;
  payable: number;
  netDebt: number;
  topReceivables: Array<{ contactId?: string; counterparty: string; amount: number }>;
  topPayables: Array<{ contactId?: string; counterparty: string; amount: number }>;
}

export interface IAnalyticsCurrentPosition {
  cashflowBalance: number;
  receivable: number;
  payable: number;
  netWorth: number;
}

export interface IFinanceAnalyticsResponse {
  summary: IFinanceAnalyticsSummary;
  currentPosition: IAnalyticsCurrentPosition;
  trend: IAnalyticsTrendBucket[];
  categories: IAnalyticsCategoryBreakdown[];
  debts: IAnalyticsDebtBreakdown;
}

export interface ThreadMediaBackupConfig {
  enabled: boolean;
  uploadImages: boolean;
  uploadVideos: boolean;
  uploadFiles?: boolean;
  uploadAudios?: boolean;
  notifyInThread?: boolean;
  customFolder?: string;
  fileSuffix?: string;
  photosAlbum?: string;
}

export interface ThreadConfirmationConfig {
  allowReactions: boolean;
  requiredHearts: number;
  timeoutMinutes: number;
}

export interface ThreadDirectInteractionConfig {
  enabled: boolean;
  /** Prefixes that address the bot in a group, besides an @mention. Matched case-insensitively. */
  triggerPrefixes: string[];
  allowAiChat?: boolean;
  allowSelf?: boolean;
}

/**
 * Per-thread chat memory, two independent switches: short-term (latest messages in the prompt, for
 * follow-ups) and long-term (every message stored, searched for questions about the past).
 */
export interface ThreadChatMemoryConfig {
  /** Long-term memory: store messages in Postgres and answer questions about them. */
  enabled: boolean;
  /** Short-term memory: add the latest messages to the LLM prompt. */
  shortTermEnabled: boolean;
  /** Latest messages kept by the short-term memory. */
  contextWindow: number;
  /** Days a message stays in the short-term memory, counted from when it was sent. */
  shortTermDays: number;
  /** Best-matching messages fetched per history search. */
  searchLimit: number;
  /**
   * Read the text of photos posted in the chat (local OCR) and remember it with the photo. Only
   * acts while at least one memory is on.
   */
  readImageText: boolean;
}

export const CHAT_MEMORY_DEFAULTS: ThreadChatMemoryConfig = {
  enabled: false,
  shortTermEnabled: false,
  contextWindow: 10,
  shortTermDays: 1,
  searchLimit: 15,
  readImageText: true,
};

export const CHAT_MEMORY_LIMITS = {
  CONTEXT_WINDOW_MIN: 1,
  CONTEXT_WINDOW_MAX: 30,
  SHORT_TERM_DAYS_MIN: 1,
  SHORT_TERM_DAYS_MAX: 7,
  SEARCH_LIMIT_MIN: 1,
  SEARCH_LIMIT_MAX: 50,
} as const;

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  const number =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

/**
 * Cleans a stored or submitted chat-memory config: missing fields take the defaults, numbers are
 * rounded and clamped. Thread config updates are not class-validated, so this is the only guard.
 * Configs saved before the short-term switch existed turned it off with `contextWindow: 0` and
 * shared the long-term switch, so they keep that behaviour.
 */
export function normalizeChatMemoryConfig(value: unknown): ThreadChatMemoryConfig {
  const raw: Record<string, unknown> =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const enabled = raw.enabled === true;
  const window = clampInteger(
    raw.contextWindow,
    0,
    CHAT_MEMORY_LIMITS.CONTEXT_WINDOW_MAX,
    CHAT_MEMORY_DEFAULTS.contextWindow,
  );
  return {
    enabled,
    shortTermEnabled:
      typeof raw.shortTermEnabled === 'boolean' ? raw.shortTermEnabled : enabled && window > 0,
    contextWindow:
      window >= CHAT_MEMORY_LIMITS.CONTEXT_WINDOW_MIN ? window : CHAT_MEMORY_DEFAULTS.contextWindow,
    shortTermDays: clampInteger(
      raw.shortTermDays,
      CHAT_MEMORY_LIMITS.SHORT_TERM_DAYS_MIN,
      CHAT_MEMORY_LIMITS.SHORT_TERM_DAYS_MAX,
      CHAT_MEMORY_DEFAULTS.shortTermDays,
    ),
    searchLimit: clampInteger(
      raw.searchLimit,
      CHAT_MEMORY_LIMITS.SEARCH_LIMIT_MIN,
      CHAT_MEMORY_LIMITS.SEARCH_LIMIT_MAX,
      CHAT_MEMORY_DEFAULTS.searchLimit,
    ),
    // Configs saved before the photo switch existed get it on, like new ones.
    readImageText:
      typeof raw.readImageText === 'boolean'
        ? raw.readImageText
        : CHAT_MEMORY_DEFAULTS.readImageText,
  };
}

/**
 * Who may call the bot in a thread, on top of global access (admins and `grantAccess` users are
 * always allowed). `granted-users` keeps the global rule only.
 */
export type ThreadMemberAccessMode = 'granted-users' | 'all-members' | 'selected-members';

export const THREAD_MEMBER_ACCESS_MODES: readonly ThreadMemberAccessMode[] = [
  'granted-users',
  'all-members',
  'selected-members',
];

export interface ThreadMemberAccessConfig {
  mode: ThreadMemberAccessMode;
  /** ZCA UIDs granted in this thread only; used when `mode` is `selected-members`. */
  memberIds: string[];
}

export const MEMBER_ACCESS_DEFAULTS: ThreadMemberAccessConfig = {
  mode: 'granted-users',
  memberIds: [],
};

export const MEMBER_ACCESS_LIMITS = {
  MAX_MEMBERS: 1000,
} as const;

function isThreadMemberAccessMode(value: unknown): value is ThreadMemberAccessMode {
  return THREAD_MEMBER_ACCESS_MODES.some((mode) => mode === value);
}

/**
 * Cleans a stored or submitted member-access config: an unknown mode falls back to
 * `granted-users`, ids are trimmed strings, de-duplicated and capped.
 */
export function normalizeMemberAccessConfig(value: unknown): ThreadMemberAccessConfig {
  const raw: Record<string, unknown> =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const memberIds: string[] = [];
  for (const candidate of Array.isArray(raw.memberIds) ? raw.memberIds : []) {
    const id =
      typeof candidate === 'string' || typeof candidate === 'number'
        ? String(candidate).trim()
        : '';
    if (id && !memberIds.includes(id)) memberIds.push(id);
    if (memberIds.length >= MEMBER_ACCESS_LIMITS.MAX_MEMBERS) break;
  }
  return {
    mode: isThreadMemberAccessMode(raw.mode) ? raw.mode : MEMBER_ACCESS_DEFAULTS.mode,
    memberIds,
  };
}

/** A member of a ZCA group, as listed on the thread config page. */
export interface IZcaGroupMember {
  id: string;
  displayName: string;
  zaloName?: string;
  avatar?: string;
}

export interface IZcaGroupMembersResponse {
  members: IZcaGroupMember[];
  totalMembers: number;
  fetchedAt: number;
}

export const TRIGGER_PREFIX_LIMITS = {
  MAX_COUNT: 10,
  MAX_LENGTH: 20,
} as const;

/** Why a candidate prefix is rejected, or `null` when it is usable. */
export type TriggerPrefixError = 'empty' | 'whitespace' | 'too_long' | 'duplicate' | 'too_many';

export function validateTriggerPrefix(
  candidate: string,
  existing: readonly string[],
): TriggerPrefixError | null {
  const value = candidate.trim();
  if (!value) return 'empty';
  if (/\s/.test(value)) return 'whitespace';
  if (value.length > TRIGGER_PREFIX_LIMITS.MAX_LENGTH) return 'too_long';
  const lower = value.toLowerCase();
  if (existing.some((prefix) => prefix.toLowerCase() === lower)) return 'duplicate';
  if (existing.length >= TRIGGER_PREFIX_LIMITS.MAX_COUNT) return 'too_many';
  return null;
}

/**
 * Cleans a stored or submitted prefix list: drops invalid and duplicate entries, caps the count,
 * and orders longest first so `bot:` wins over `b` when matching.
 * Accepts the legacy single `triggerPrefix` string still present in older rows.
 */
export function normalizeTriggerPrefixes(input: {
  triggerPrefixes?: readonly unknown[];
  triggerPrefix?: unknown;
}): string[] {
  const candidates: unknown[] = [...(input.triggerPrefixes ?? []), input.triggerPrefix];
  const result: string[] = [];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    if (validateTriggerPrefix(candidate, result) === null) result.push(candidate.trim());
  }
  return result.sort((a, b) => b.length - a.length);
}

/** Returns the configured prefix the text starts with (case-insensitive), or `null`. */
export function findTriggerPrefix(text: string, prefixes: readonly string[]): string | null {
  const head = text.trimStart().toLowerCase();
  const sorted = [...prefixes].sort((a, b) => b.length - a.length);
  return sorted.find((prefix) => prefix && head.startsWith(prefix.toLowerCase())) ?? null;
}

export interface ThreadBotConfig {
  threadId: string;
  threadName?: string;
  threadType?: 'user' | 'group';
  isListened: boolean;
  driveFolderId?: string;
  driveFolderUrl?: string;
  driveFolderPath?: string;
  photosAlbumId?: string;
  photosAlbumUrl?: string;
  photosAlbumTitle?: string;
  directInteraction: ThreadDirectInteractionConfig;
  mediaBackup: ThreadMediaBackupConfig;
  confirmationRules: ThreadConfirmationConfig;
  chatMemory: ThreadChatMemoryConfig;
  memberAccess: ThreadMemberAccessConfig;
  updatedAt?: number;
}

export type UpdateThreadBotConfigDto = Partial<{
  threadName: string;
  threadType: 'user' | 'group';
  isListened: boolean;
  driveFolderId: string;
  driveFolderUrl: string;
  driveFolderPath: string;
  photosAlbumId: string;
  photosAlbumUrl: string;
  photosAlbumTitle: string;
  directInteraction: Partial<ThreadDirectInteractionConfig>;
  mediaBackup: Partial<ThreadMediaBackupConfig>;
  confirmationRules: Partial<ThreadConfirmationConfig>;
  chatMemory: Partial<ThreadChatMemoryConfig>;
  memberAccess: Partial<ThreadMemberAccessConfig>;
}>;

export type ChannelStorageLinkKind = 'drive' | 'photos';

/** One Drive root folder or Photos album a channel's media has been stored in. */
export interface ChannelStorageLink {
  /** Row to edit/delete; the change applies to every row of the thread with this kind + URL. */
  id: string;
  kind: ChannelStorageLinkKind;
  url: string;
  /** Drive folder path or Photos album title (rewritten by uploads). */
  label: string;
  /** Name an admin gave the link; shown instead of `label` when set. */
  displayName: string | null;
  /** Null for links recorded before the Google account was tracked. */
  googleEmail: string | null;
  firstUsedAt: string;
  lastUsedAt: string;
  /** Where new media of the channel goes with the current shared Google account. */
  isCurrent: boolean;
}

/** The shared Google account every channel's media is uploaded with. */
export interface IGoogleStorageAccountStatus {
  connected: boolean;
  email: string | null;
  /** Granted both Drive and Photos scopes; uploads need both. */
  hasStorageScopes: boolean;
}

export interface IGoogleStorageLoginResponse {
  authUrl: string;
}

/** Newest first. */
export interface ChannelStorageLinksResponse {
  threadId: string;
  drive: ChannelStorageLink[];
  photos: ChannelStorageLink[];
}

/** Omitted field = unchanged; `null` / empty string clears `displayName` / `googleEmail`. */
export interface UpdateChannelStorageLinkDto {
  displayName?: string | null;
  url?: string;
  googleEmail?: string | null;
}

export interface NormalizedChannelStorageLinkUpdate {
  displayName?: string | null;
  url?: string;
  googleEmail?: string | null;
}

/** An existing Drive folder / Photos album an admin adds to the history; nothing is created on Google. */
export interface CreateChannelStorageLinkDto {
  kind: ChannelStorageLinkKind;
  url: string;
  displayName?: string | null;
  googleEmail?: string | null;
}

export interface NormalizedChannelStorageLinkCreate {
  url: string;
  displayName: string | null;
  googleEmail: string | null;
}

export const CHANNEL_STORAGE_LINK_LIMITS = {
  DISPLAY_NAME_MAX_LENGTH: 120,
} as const;

/** Hosts a link of each kind may point to (https only). */
export const CHANNEL_STORAGE_LINK_HOSTS: Record<ChannelStorageLinkKind, readonly string[]> = {
  drive: ['drive.google.com'],
  photos: ['photos.google.com', 'photos.app.goo.gl'],
};

/** `url_duplicate` only comes from `validateChannelStorageLinkCreate`. */
export type ChannelStorageLinkUpdateError =
  | 'display_name_too_long'
  | 'url_required'
  | 'url_invalid'
  | 'url_wrong_host'
  | 'url_duplicate'
  | 'email_invalid';

export type ChannelStorageLinkUpdateErrors = Partial<
  Record<keyof UpdateChannelStorageLinkDto, ChannelStorageLinkUpdateError>
>;

const STORAGE_LINK_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateStorageLinkUrl(
  kind: ChannelStorageLinkKind,
  raw: unknown,
): { url: string } | { error: ChannelStorageLinkUpdateError } {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return { error: 'url_required' };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { error: 'url_invalid' };
  }
  if (url.protocol !== 'https:') return { error: 'url_invalid' };
  return CHANNEL_STORAGE_LINK_HOSTS[kind].includes(url.hostname.toLowerCase())
    ? { url: url.toString() }
    : { error: 'url_wrong_host' };
}

/**
 * Validates and normalizes an edit of a channel storage link (shared by the API and the web
 * form): trims, turns empty name/email into `null`, lower-cases the email, and only accepts an
 * https URL on a host of the link's kind.
 */
export function validateChannelStorageLinkUpdate(
  kind: ChannelStorageLinkKind,
  dto: UpdateChannelStorageLinkDto,
):
  | { ok: true; value: NormalizedChannelStorageLinkUpdate }
  | { ok: false; errors: ChannelStorageLinkUpdateErrors } {
  const value: NormalizedChannelStorageLinkUpdate = {};
  const errors: ChannelStorageLinkUpdateErrors = {};

  if (dto.displayName !== undefined) {
    const name = typeof dto.displayName === 'string' ? dto.displayName.trim() : '';
    if (name.length > CHANNEL_STORAGE_LINK_LIMITS.DISPLAY_NAME_MAX_LENGTH) {
      errors.displayName = 'display_name_too_long';
    } else {
      value.displayName = name || null;
    }
  }

  if (dto.url !== undefined) {
    const result = validateStorageLinkUrl(kind, dto.url);
    if ('error' in result) {
      errors.url = result.error;
    } else {
      value.url = result.url;
    }
  }

  if (dto.googleEmail !== undefined) {
    const email = typeof dto.googleEmail === 'string' ? dto.googleEmail.trim().toLowerCase() : '';
    if (email && !STORAGE_LINK_EMAIL_PATTERN.test(email)) {
      errors.googleEmail = 'email_invalid';
    } else {
      value.googleEmail = email || null;
    }
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value };
}

const STORAGE_RESOURCE_ID_PATTERNS: Record<ChannelStorageLinkKind, RegExp> = {
  drive: /\/folders\/([\w-]+)/,
  // Photos API album URLs are `/lr/album/<id>`; links copied from the app are `/album/<id>`.
  photos: /\/album\/([\w-]+)/,
};

/**
 * Drive folder id / Photos album id in a link (uploads key history rows by it), or the link
 * itself when it holds none, e.g. a short `photos.app.goo.gl` link (like backfilled rows).
 */
export function channelStorageResourceIdFromUrl(kind: ChannelStorageLinkKind, url: string): string {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return url;
  }
  return STORAGE_RESOURCE_ID_PATTERNS[kind].exec(pathname)?.[1] ?? url;
}

function normalizeStorageLinkUrl(raw: string): string {
  try {
    return new URL(raw.trim()).toString();
  } catch {
    return raw.trim();
  }
}

/**
 * Validates and normalizes a link an admin adds by hand: the edit rules, plus a required URL that
 * the channel does not list yet (`existingUrls`: its links of the same kind). Two URLs are the
 * same link when they normalize equal or hold the same folder / album id.
 */
export function validateChannelStorageLinkCreate(
  kind: ChannelStorageLinkKind,
  dto: Omit<CreateChannelStorageLinkDto, 'kind'>,
  existingUrls: readonly string[],
):
  | { ok: true; value: NormalizedChannelStorageLinkCreate }
  | { ok: false; errors: ChannelStorageLinkUpdateErrors } {
  const details = validateChannelStorageLinkUpdate(kind, {
    displayName: dto.displayName ?? null,
    googleEmail: dto.googleEmail ?? null,
  });
  const urlResult = validateStorageLinkUrl(kind, dto.url);
  const errors: ChannelStorageLinkUpdateErrors = 'errors' in details ? { ...details.errors } : {};

  if ('error' in urlResult) {
    errors.url = urlResult.error;
  } else {
    const resourceId = channelStorageResourceIdFromUrl(kind, urlResult.url);
    const listed = existingUrls.some(
      (existing) =>
        normalizeStorageLinkUrl(existing) === urlResult.url ||
        channelStorageResourceIdFromUrl(kind, existing) === resourceId,
    );
    if (listed) errors.url = 'url_duplicate';
  }

  if ('errors' in details || 'error' in urlResult || errors.url) return { ok: false, errors };
  return {
    ok: true,
    value: {
      url: urlResult.url,
      displayName: details.value.displayName ?? null,
      googleEmail: details.value.googleEmail ?? null,
    },
  };
}

export type SyncMediaTimeRange = 'all' | '1_month' | '2_months' | '3_months' | '6_months';

export interface SyncThreadMediaDto {
  limit?: number;
  timeRange?: SyncMediaTimeRange;
  sinceTimestamp?: number;
  mediaTypes?: ('image' | 'video' | 'file' | 'audio')[];
}

export interface SyncThreadMediaResponse {
  threadId: string;
  scannedCount: number;
  foundCount: number;
  syncedCount: number;
  skippedCount: number;
  failedCount: number;
  message: string;
  warning?: string;
}

/** Who caused an audited change: a dashboard user, a Zalo sender, or a background job. */
export const AUDIT_ACTOR_SOURCES = ['dashboard', 'zalo', 'system'] as const;
export type AuditActorSource = (typeof AUDIT_ACTOR_SOURCES)[number];
/** Source filter of the activity log; `legacy` matches rows written before the actor was recorded. */
export const AUDIT_SOURCE_FILTERS = [...AUDIT_ACTOR_SOURCES, 'legacy'] as const;
export type AuditSourceFilter = (typeof AUDIT_SOURCE_FILTERS)[number];

export const AUDIT_ACTIONS = ['insert', 'update', 'remove'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_TABLE_GROUPS = ['finance', 'planning', 'system'] as const;
export type AuditTableGroup = (typeof AUDIT_TABLE_GROUPS)[number];

/**
 * Tables the activity log knows. `technical` ones (Google tokens, dashboard sign-in tokens, the
 * sent marks of each reminder time) are high-volume bookkeeping, hidden unless asked for.
 */
export const AUDIT_TABLES = [
  { table: 'finance_transactions', group: 'finance', technical: false },
  { table: 'debts', group: 'finance', technical: false },
  { table: 'debt_payments', group: 'finance', technical: false },
  { table: 'debt_payment_allocations', group: 'finance', technical: false },
  { table: 'debt_contacts', group: 'finance', technical: false },
  { table: 'finance_places', group: 'finance', technical: false },
  { table: 'user_categories', group: 'finance', technical: false },
  { table: 'tasks', group: 'planning', technical: false },
  { table: 'task_reminder_times', group: 'planning', technical: true },
  { table: 'calendar_events', group: 'planning', technical: false },
  { table: 'reminders', group: 'planning', technical: false },
  { table: 'reminder_times', group: 'planning', technical: true },
  { table: 'users', group: 'system', technical: false },
  { table: 'zca_thread_configs', group: 'system', technical: false },
  { table: 'channel_storage_links', group: 'system', technical: false },
  { table: 'user_tokens', group: 'system', technical: true },
  { table: 'dashboard_exchange_tokens', group: 'system', technical: true },
] as const satisfies readonly { table: string; group: AuditTableGroup; technical: boolean }[];
export type AuditTableName = (typeof AUDIT_TABLES)[number]['table'];
export const AUDIT_TECHNICAL_TABLES: readonly AuditTableName[] = AUDIT_TABLES.filter(
  (entry) => entry.technical,
).map((entry) => entry.table);

export function isAuditTableName(value: unknown): value is AuditTableName {
  return typeof value === 'string' && AUDIT_TABLES.some((entry) => entry.table === value);
}

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === 'string' && (AUDIT_ACTIONS as readonly string[]).includes(value);
}

export function isAuditSourceFilter(value: unknown): value is AuditSourceFilter {
  return typeof value === 'string' && (AUDIT_SOURCE_FILTERS as readonly string[]).includes(value);
}

export const AUDIT_LOG_DEFAULT_LIMIT = 50;
export const AUDIT_LOG_MAX_LIMIT = 200;

export interface IAuditLogListQuery {
  tables?: AuditTableName[];
  actions?: AuditAction[];
  sources?: AuditSourceFilter[];
  actorIds?: string[];
  recordId?: string;
  /** Inclusive ISO bounds on the change time. */
  startAt?: string;
  endAt?: string;
  /** Also list `technical` tables when no table is picked. */
  includeTechnical?: boolean;
  limit?: number;
  offset?: number;
}

export interface IAuditLogListItem {
  id: string;
  /** Raw table name; tables outside `AUDIT_TABLES` keep theirs. */
  tableName: string;
  /** Null for a bulk change (update/delete by criteria). */
  recordId: string | null;
  action: AuditAction;
  actorId: string | null;
  /** Empty when the actor has no profile name. */
  actorName: string;
  /** The fixed-code dashboard owner account, which has no Zalo profile. */
  actorIsOwner: boolean;
  /**
   * Null = written before the actor was recorded: `actorId` is then the row's creator,
   * not necessarily who changed it.
   */
  actorSource: AuditActorSource | null;
  channelId: string | null;
  /** Empty when the channel has no stored name. */
  channelName: string;
  channelType: 'group' | 'user' | null;
  /** Fields that changed (update with a before copy) or were written (bulk update); empty otherwise. */
  changedFields: string[];
  createdAt: string;
}

export interface IAuditLogActorFacet {
  id: string;
  /** Empty when the actor has no profile name. */
  name: string;
  isOwner: boolean;
}

export interface IAuditLogListResponse {
  items: IAuditLogListItem[];
  total: number;
  limit: number;
  offset: number;
  /** Everyone who appears in the log, independent of the current filters. */
  facets: { actors: IAuditLogActorFacet[] };
}

export interface IAuditLogDetail extends IAuditLogListItem {
  /** Secrets (`token`, `secret`, `password`, `authorization` keys) are redacted when written. */
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
}

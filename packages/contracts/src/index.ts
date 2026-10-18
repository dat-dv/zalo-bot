export const API_ROUTES = {
  access: '/api/access',
  dashboard: '/api/dashboard',
  dashboardRefresh: '/api/refresh',
  dashboardLogout: '/api/logout',
  categories: '/api/categories',
  places: '/api/places',
  placesCombine: '/api/places/combine',
  contacts: '/api/contacts',
  contactsCombine: '/api/contacts/combine',
  debts: '/api/debts',
  debtsCombine: '/api/debts/combine',
  debtPayments: '/api/debts/payments',
  expenses: '/api/expenses',
  transactions: '/api/transactions',
  financeAnalytics: '/api/finance/analytics',
  reminders: '/api/reminders',
  users: '/api/users',
  usersGrantAccess: (id: string) => `/api/users/${id}/grant-access`,
  calendarEvents: '/api/calendar/events',
  tasks: '/api/tasks',
  googleAuthCallback: '/api/oauth2callback',
  swaggerDocs: '/api/docs',
  transactionCandidateDebts: (id: string) => `/api/transactions/${id}/candidate-debts`,
  transactionAllocations: (id: string) => `/api/transactions/${id}/allocations`,
  transactionAllocationDetail: (txId: string, allocId: string) =>
    `/api/transactions/${txId}/allocations/${allocId}`,
  healthDeploy: '/health/deploy',
  deployNotify: '/api/deploy/notify',
  zcaStatus: '/api/zca/status',
  zcaQr: '/api/zca/qr',
  zcaLoginQr: '/api/zca/login-qr',
  zcaLogout: '/api/zca/logout',
  zcaThreads: '/api/zca/threads',
  zcaListenedThreads: '/api/zca/listened-threads',
  zcaListenedThreadsToggle: '/api/zca/listened-threads/toggle',
  zcaThreadConfigs: '/api/zca/thread-configs',
  zcaThreadConfig: (threadId: string) => `/api/zca/thread-configs/${threadId}`,
  driveFolderLink: '/api/drive/folder-link',
  driveOpen: '/api/drive/open',
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
  places: '/places',
  users: '/users',
  zca: '/zca',
  settings: '/settings',
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
    'common.refresh': 'Làm mới',
    'common.retry': 'Thử lại',
    'common.logout': 'Đăng xuất',
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
    'nav.users': 'Người dùng',
    'nav.zca': 'Tài khoản ZCA',
    'zca.logout': 'Đăng xuất ZCA',
    'zca.logoutConfirm': 'Bạn có chắc chắn muốn ngắt kết nối và đăng xuất tài khoản Zalo cá nhân (ZCA) này không?',
    'zca.logoutSuccess': 'Đã đăng xuất tài khoản ZCA thành công.',
    'nav.personalSpace': 'Cá nhân',
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
    'web.language.vi': 'Tiếng Việt',
    'web.language.en': 'English',
    'reminder.header.text': '⏰ *TING TING! LỜI NHẮC CỦA BẠN ĐÃ ĐẾN GIỜ!*',
    'reminder.header.call': '📞 *CUỘC GỌI NHẮC NHỞ TỰ ĐỘNG (CALLME)!*',
    'reminder.done': '✅ Đã xong',
    'reminder.snooze': '⏳ Nhắc lại 15 phút',
    'zalo.language.updated': '✅ Đã đổi ngôn ngữ sang Tiếng Việt.',
    'zalo.language.choose': 'Chọn ngôn ngữ hiển thị:',
    'zalo.reminders.empty': '⏰ Hiện bạn không có lời nhắc nào sắp tới.',
    'zalo.reminders.fetchError': '⚠️ Không thể lấy danh sách lời nhắc: {error}',
    'zalo.reminders.cancelButton': '🗑️ Hủy #{index}',
    'zalo.reminders.refresh': '🔄 Làm mới',
    'zalo.reminders.close': '❌ Đóng',
    'table.searchPlaceholder': 'Tìm kiếm nhanh...',
    'table.filter.all': 'Tất cả',
    'table.filter.receivable': 'Cho vay',
    'table.filter.payable': 'Đi vay',
    'table.filter.income': 'Thu',
    'table.filter.expense': 'Chi',
    'table.ordinal': 'STT',
    'table.id': 'ID',
    'table.rowsCount': '{count} dòng',
    'table.total': 'Tổng: {total}',
    'table.columnSettings': 'Cài đặt cột',
    'table.columnVisibility': 'Ẩn/hiện cột',
    'table.showAllColumns': 'Hiện tất cả',
    'table.resetColumns': 'Đặt lại mặc định',
    'table.columnsCount': '{visible}/{total} cột',
    'table.scrollHint': 'Cuộn ngang để xem thêm',
    'table.columnRequired': 'Bắt buộc',
    'table.columnsHiddenBadge': '{count} ẩn',
    'table.idClickToInspect': 'Nhấn để xem chi tiết ID & câu lệnh cho AI Agent',
    'table.idModal.title': 'Chi tiết định danh bản ghi',
    'table.idModal.subtitle': 'Thông tin định danh CSDL & mẫu câu lệnh thao tác cho AI Agent',
    'table.idModal.tableName': 'Bảng dữ liệu',
    'table.idModal.entityName': 'Thực thể nghiệp vụ',
    'table.idModal.fullId': 'Mã định danh đầy đủ (ID)',
    'table.idModal.copyId': 'Sao chép ID',
    'table.idModal.copied': 'Đã sao chép!',
    'table.idModal.agentPromptTitle': 'Mẫu câu lệnh nhanh cho AI Agent (zalo Bot)',
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
    'dashboard.error.desc': 'Phiên làm việc đã hết hạn. Hãy mở lại từ zalo bot.',
    'auth.loggedOut.title': 'Đã đăng xuất thành công',
    'auth.loggedOut.desc':
      'Phiên làm việc của bạn đã kết thúc an toàn. Hãy mở lại từ zalo bot để bắt đầu phiên mới.',
    'auth.sessionExpired.title': 'Phiên làm việc đã hết hạn',
    'auth.sessionExpired.desc':
      'Phiên truy cập đã hết hạn hoặc không tìm thấy thông tin đăng nhập. Hãy mở lại từ zalo bot.',
    'auth.openzaloBot': 'Mở zalo Bot',
    'auth.clearSessionAndRetry': 'Xóa phiên & Thử lại',
    'auth.backToAbout': 'Xem trang giới thiệu',
    'auth.closeMiniApp': 'Đóng cửa sổ',
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
    'places.combineModal.title': 'Gộp nơi chốn / Cửa hàng',
    'places.combineModal.desc':
      'Tập hợp các địa điểm trùng lặp và chuyển toàn bộ giao dịch sang một địa điểm chính.',
    'places.combineModal.placesList': 'Tập hợp các nơi chốn cần gộp',
    'places.combineModal.leadBadge': 'Nơi chốn chính (Lead)',
    'places.combineModal.leadHint':
      'Mặc định chọn nơi chốn có nhiều giao dịch nhất làm lead. Bạn có thể chọn địa điểm khác nếu muốn.',
    'places.combineModal.newNameLabel': 'Tên nơi chốn mới sau khi gộp',
    'places.combineModal.transactionsBadge': '{count} giao dịch',
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
    'calendar.subtitle': 'Lịch trình sự kiện 7 ngày tới',
    'calendar.columns.description': 'Mô tả',
    'calendar.columns.location': 'Địa điểm',
    'calendar.columns.endAt': 'Kết thúc',
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
    'tasks.title': 'Việc cần làm',
    'tasks.subtitle': 'Danh sách công việc từ Google Tasks',
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
    'tasks.delete.confirm': 'Bạn có chắc chắn muốn xóa công việc này không?',
    'tasks.delete.success': 'Đã xóa công việc',
    'tasks.filter.all': 'Tất cả',
    'tasks.filter.needsAction': 'Cần làm',
    'tasks.filter.completed': 'Đã xong',
    'tasks.stats.total': 'Tổng số việc',
    'tasks.stats.pending': 'Cần làm',
    'tasks.stats.completed': 'Đã xong',
    'tasks.stats.overdue': 'Quá hạn',
    'reminders.title': 'Nhắc nhở',
    'reminders.subtitle': 'Danh sách lời nhắc tự động qua zalo & Gọi điện',
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
    'reminders.placeholder.title': 'Nhập tiêu đề lời nhắc...',
    'period.day': 'Ngày',
    'period.week': 'Tuần',
    'period.month': 'Tháng',
    'period.quarter': 'Quý',
    'period.year': 'Năm',
    'period.all': 'Tất cả',
    'period.prev': 'Kỳ trước',
    'period.next': 'Kỳ sau',
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
    'public.about.eyebrow': 'TRỢ LÝ CÁ NHÂN TRÊN zalo',
    'public.about.title': 'Quản lý kế hoạch và tài chính cá nhân, gọn trong một nơi.',
    'public.about.description':
      'zalobot giúp bạn ghi nhận thu chi, theo dõi công nợ, tạo lời nhắc và đồng bộ lịch trình hoặc việc cần làm với Google khi bạn lựa chọn kết nối.',
    'public.about.zalo': 'Mở zalo để bắt đầu',
    'public.about.features': 'Tính năng zalobot',
    'public.about.financeTitle': 'Quản lý tài chính',
    'public.about.financeDescription':
      'Ghi nhận thu chi, theo dõi khoản vay và xem lại tổng quan theo thời gian.',
    'public.about.planningTitle': 'Kế hoạch rõ ràng',
    'public.about.planningDescription':
      'Tạo nhắc nhở, theo dõi việc cần làm và quản lý lịch trình cá nhân.',
    'public.about.googleTitle': 'Kết nối Google theo lựa chọn',
    'public.about.googleDescription':
      'Khi bạn cấp quyền, zalobot dùng Google Calendar và Google Tasks để thực hiện đúng các lệnh bạn yêu cầu.',
    'public.about.copyright': '© {year} zalobot',
    'public.about.support': 'Hỗ trợ: {email}',
    'public.about.privacyPolicy': 'Privacy Policy',
    'public.about.termsOfService': 'Terms of Service',
    'public.privacy.title': 'Chính sách quyền riêng tư',
    'public.privacy.intro':
      'zalobot tôn trọng quyền riêng tư của bạn. Chính sách này mô tả dữ liệu chúng tôi xử lý, lý do xử lý và các lựa chọn của bạn.',
    'public.privacy.dataTitle': '1. Dữ liệu chúng tôi xử lý',
    'public.privacy.dataDescription':
      'Để vận hành bot, zalobot lưu zalo user ID, dữ liệu tài chính và kế hoạch do bạn nhập, cùng dữ liệu kỹ thuật cần thiết để duy trì dịch vụ.',
    'public.privacy.scopesIntro':
      'Khi bạn chủ động kết nối Google, chúng tôi chỉ yêu cầu các quyền sau:',
    'public.privacy.profileScope':
      'Thông tin hồ sơ cơ bản và địa chỉ email để nhận diện tài khoản đã kết nối.',
    'public.privacy.calendarScope':
      'Google Calendar để đọc, tạo, cập nhật hoặc xóa sự kiện theo lệnh của bạn.',
    'public.privacy.tasksScope':
      'Google Tasks để đọc, tạo, cập nhật hoặc hoàn thành việc cần làm theo lệnh của bạn.',
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
      'Bạn chịu trách nhiệm với các lệnh được gửi từ tài khoản zalo của mình. Kết nối Google là tự nguyện và có thể được thu hồi theo hướng dẫn tại Chính sách quyền riêng tư.',
    'public.terms.legalTitle': '4. Sử dụng hợp pháp',
    'public.terms.legalDescription':
      'Bạn không được sử dụng zalobot để vi phạm pháp luật, xâm phạm quyền của người khác, can thiệp trái phép vào dịch vụ hoặc gây ảnh hưởng đến hoạt động của hệ thống.',
    'public.terms.changeTitle': '5. Thay đổi dịch vụ',
    'public.terms.changeDescription':
      'Chúng tôi có thể cập nhật dịch vụ hoặc điều khoản khi cần thiết. Phiên bản mới sẽ được công bố trên trang này.',
    'public.terms.contactTitle': '6. Liên hệ',
    'public.terms.contactDescription': 'Liên hệ hỗ trợ: {email}.',
  },
  en: {
    'common.refresh': 'Refresh',
    'common.retry': 'Try again',
    'common.logout': 'Log out',
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
    'nav.users': 'Users',
    'nav.zca': 'ZCA Account',
    'zca.logout': 'Logout ZCA',
    'zca.logoutConfirm': 'Are you sure you want to disconnect and logout this ZCA personal account?',
    'zca.logoutSuccess': 'ZCA account logged out successfully.',
    'nav.personalSpace': 'Personal',
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
    'web.language.vi': 'Tiếng Việt',
    'web.language.en': 'English',
    'reminder.header.text': '⏰ *REMINDER: IT IS TIME!*',
    'reminder.header.call': '📞 *AUTOMATED REMINDER CALL (CALLME)!*',
    'reminder.done': '✅ Done',
    'reminder.snooze': '⏳ Remind me in 15 minutes',
    'zalo.language.updated': '✅ Language changed to English.',
    'zalo.language.choose': 'Choose your display language:',
    'zalo.reminders.empty': '⏰ You have no upcoming reminders.',
    'zalo.reminders.fetchError': '⚠️ Unable to fetch reminders: {error}',
    'zalo.reminders.cancelButton': '🗑️ Cancel #{index}',
    'zalo.reminders.refresh': '🔄 Refresh',
    'zalo.reminders.close': '❌ Close',
    'table.searchPlaceholder': 'Quick search...',
    'table.filter.all': 'All',
    'table.filter.receivable': 'Lent',
    'table.filter.payable': 'Borrowed',
    'table.filter.income': 'Income',
    'table.filter.expense': 'Expense',
    'table.ordinal': 'No.',
    'table.id': 'ID',
    'table.rowsCount': '{count} rows',
    'table.total': 'Total: {total}',
    'table.columnSettings': 'Column settings',
    'table.columnVisibility': 'Toggle columns',
    'table.showAllColumns': 'Show all',
    'table.resetColumns': 'Reset to default',
    'table.columnsCount': '{visible}/{total} cols',
    'table.scrollHint': 'Scroll horizontally to view more',
    'table.columnRequired': 'Required',
    'table.columnsHiddenBadge': '{count} hidden',
    'table.idClickToInspect': 'Click to view ID details & AI Agent prompt templates',
    'table.idModal.title': 'Record Identifier Details',
    'table.idModal.subtitle': 'Database entity identifier & AI Agent prompt templates',
    'table.idModal.tableName': 'Database Table',
    'table.idModal.entityName': 'Domain Entity',
    'table.idModal.fullId': 'Full Identifier (ID)',
    'table.idModal.copyId': 'Copy ID',
    'table.idModal.copied': 'Copied!',
    'table.idModal.agentPromptTitle': 'Quick Prompt Templates for AI Agent (zalo Bot)',
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
    'dashboard.error.desc': 'Session expired. Please open again from the zalo bot.',
    'auth.loggedOut.title': 'Logged out successfully',
    'auth.loggedOut.desc':
      'Your session has ended securely. Please open again from the zalo bot to start a new session.',
    'auth.sessionExpired.title': 'Session expired',
    'auth.sessionExpired.desc':
      'Your access session has expired or no credentials were found. Please open again from the zalo bot.',
    'auth.openzaloBot': 'Open zalo Bot',
    'auth.clearSessionAndRetry': 'Clear session & retry',
    'auth.backToAbout': 'About zalobot',
    'auth.closeMiniApp': 'Close window',
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
    'places.combineModal.title': 'Combine Places / Stores',
    'places.combineModal.desc':
      'Merge duplicate places and reassign all transactions to a single lead place.',
    'places.combineModal.placesList': 'Places to combine',
    'places.combineModal.leadBadge': 'Lead place',
    'places.combineModal.leadHint':
      'Defaults to the place with the highest transaction count. You can select another place if preferred.',
    'places.combineModal.newNameLabel': 'New place name after merge',
    'places.combineModal.transactionsBadge': '{count} transactions',
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
    'calendar.subtitle': 'Upcoming 7-day schedule and events',
    'calendar.columns.description': 'Description',
    'calendar.columns.location': 'Location',
    'calendar.columns.endAt': 'End time',
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
    'tasks.title': 'Tasks',
    'tasks.subtitle': 'Task list from Google Tasks',
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
    'tasks.delete.confirm': 'Are you sure you want to delete this task?',
    'tasks.delete.success': 'Task deleted successfully',
    'tasks.filter.all': 'All',
    'tasks.filter.needsAction': 'Pending',
    'tasks.filter.completed': 'Completed',
    'tasks.stats.total': 'Total tasks',
    'tasks.stats.pending': 'Pending',
    'tasks.stats.completed': 'Completed',
    'tasks.stats.overdue': 'Overdue',
    'reminders.title': 'Reminders',
    'reminders.subtitle': 'Automated reminders via zalo & Call',
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
    'reminders.placeholder.title': 'Reminder title...',
    'period.day': 'Day',
    'period.week': 'Week',
    'period.month': 'Month',
    'period.quarter': 'Quarter',
    'period.year': 'Year',
    'period.all': 'All',
    'period.prev': 'Previous period',
    'period.next': 'Next period',
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
    'public.about.eyebrow': 'YOUR PERSONAL zalo ASSISTANT',
    'public.about.title': 'Manage your personal finances and plans in one place.',
    'public.about.description':
      'zalobot helps you record income and expenses, track debts, create reminders, and sync your calendar or tasks with Google when you choose to connect.',
    'public.about.zalo': 'Open zalo to get started',
    'public.about.features': 'zalobot features',
    'public.about.financeTitle': 'Financial management',
    'public.about.financeDescription':
      'Record income and expenses, track loans, and review your overview over time.',
    'public.about.planningTitle': 'Clear planning',
    'public.about.planningDescription':
      'Create reminders, track tasks, and manage your personal schedule.',
    'public.about.googleTitle': 'Google connection by choice',
    'public.about.googleDescription':
      'When you grant permission, zalobot uses Google Calendar and Google Tasks only to perform the actions you request.',
    'public.about.copyright': '© {year} zalobot',
    'public.about.support': 'Support: {email}',
    'public.about.privacyPolicy': 'Privacy Policy',
    'public.about.termsOfService': 'Terms of Service',
    'public.privacy.title': 'Privacy Policy',
    'public.privacy.intro':
      'zalobot respects your privacy. This policy explains the data we process, why we process it, and your choices.',
    'public.privacy.dataTitle': '1. Data we process',
    'public.privacy.dataDescription':
      'To operate the bot, zalobot stores your zalo user ID, finance and planning data you enter, and technical data required to run the service.',
    'public.privacy.scopesIntro':
      'When you choose to connect Google, we request only the following permissions:',
    'public.privacy.profileScope':
      'Basic profile information and email address to identify the connected account.',
    'public.privacy.calendarScope':
      'Google Calendar to read, create, update, or delete events that you request.',
    'public.privacy.tasksScope':
      'Google Tasks to read, create, update, or complete tasks that you request.',
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
      'You are responsible for commands sent from your zalo account. Connecting Google is optional and can be revoked as described in the Privacy Policy.',
    'public.terms.legalTitle': '4. Lawful use',
    'public.terms.legalDescription':
      'You may not use zalobot to violate the law, infringe others’ rights, interfere with the service, or harm system operations.',
    'public.terms.changeTitle': '5. Service changes',
    'public.terms.changeDescription':
      'We may update the service or these terms when necessary. The latest version will be published on this page.',
    'public.terms.contactTitle': '6. Contact',
    'public.terms.contactDescription': 'Support contact: {email}.',
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
  };
  debtCount?: number;
  transactionCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface IDebtPaymentItem {
  id: string;
  debtId: string;
  userId: string;
  financeTransactionId?: string;
  amount: number;
  paymentDate: string;
  note?: string;
  createdAt: string;
}

export interface IDebtAllocationItem {
  id: string;
  userId: string;
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
  role: UserRole;
  grantAccess: GrantAccessStatus;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface IDashboardData {
  user: { name: string; isAdmin: boolean; googleConnected: boolean };
  finance: {
    income: number;
    expense: number;
    balance: number;
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
  activity: Array<{ id: string; action: string; tableName: string; createdAt: string }>;
  admin?: { userCount: number; googleConnectedCount: number };
}

export interface ICalendarEventItem {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startAt?: string;
  endAt?: string;
  timeZone?: string;
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
}

export interface ICreateCalendarEventRequest {
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  location?: string;
  timeZone?: string;
}

export interface IReminderListItem {
  id: string;
  title: string;
  remindAt: string;
  notifyType: 'text' | 'call';
  repeatType?: 'none' | 'daily' | 'weekly';
  status?: 'pending' | 'completed' | 'snoozed' | 'cancelled';
  snoozeCount?: number;
  snoozedUntil?: string;
}

export interface IUpdateReminderRequest {
  title?: string;
  remindAt?: string;
  notifyType?: 'text' | 'call';
  repeatType?: 'none' | 'daily' | 'weekly';
  status?: 'pending' | 'completed' | 'snoozed' | 'cancelled';
  snoozeCount?: number;
  snoozedUntil?: string;
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

export interface ITaskListItem {
  id: string;
  title: string;
  notes?: string;
  dueAt?: string;
  status?: 'needsAction' | 'completed';
  updatedAt?: string;
  completedAt?: string;
}

export interface IUpdateTaskRequest {
  title?: string;
  notes?: string;
  due?: string;
  status?: 'needsAction' | 'completed';
  taskListId?: string;
}

export interface ICreateTaskRequest {
  title: string;
  notes?: string;
  due?: string;
  taskListId?: string;
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
export type ReminderRepeatType = 'none' | 'daily' | 'weekly';

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
  allocations?: Array<{
    id: string;
    amount: number;
    debtId: string;
    note?: string;
    counterparty?: string;
    remainingAmount?: number;
  }>;
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
  remindAt: string;
  notifyType?: ReminderNotifyType;
  repeatType?: ReminderRepeatType;
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

export interface IDeployNotifyRequest {
  message?: string;
  version?: string;
  commit?: string;
  branch?: string;
  environment?: string;
  deployedBy?: string;
}

export interface IDeployNotifyResponse {
  status: string;
  notified: boolean;
  message: string;
  adminCount: number;
  recipients?: string[];
  timestamp: string;
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
}

export interface ThreadExpenseConfig {
  enabled: boolean;
  requireConfirm: boolean;
}

export interface ThreadCalendarConfig {
  enabled: boolean;
  requireConfirm: boolean;
}

export interface ThreadConfirmationConfig {
  allowReactions: boolean;
  requiredHearts: number;
  timeoutMinutes: number;
}

export interface ThreadDirectInteractionConfig {
  enabled: boolean;
  requireMention: boolean;
  triggerPrefix?: string;
  allowAiChat?: boolean;
  allowSelf?: boolean;
}

export interface ThreadBotConfig {
  threadId: string;
  threadName?: string;
  threadType?: 'user' | 'group';
  isListened: boolean;
  driveFolderId?: string;
  driveFolderUrl?: string;
  driveFolderPath?: string;
  directInteraction: ThreadDirectInteractionConfig;
  mediaBackup: ThreadMediaBackupConfig;
  expenseTracking: ThreadExpenseConfig;
  calendarExtraction: ThreadCalendarConfig;
  confirmationRules: ThreadConfirmationConfig;
  updatedAt?: number;
}

export type UpdateThreadBotConfigDto = Partial<{
  threadName: string;
  threadType: 'user' | 'group';
  isListened: boolean;
  driveFolderId: string;
  driveFolderUrl: string;
  driveFolderPath: string;
  directInteraction: Partial<ThreadDirectInteractionConfig>;
  mediaBackup: Partial<ThreadMediaBackupConfig>;
  expenseTracking: Partial<ThreadExpenseConfig>;
  calendarExtraction: Partial<ThreadCalendarConfig>;
  confirmationRules: Partial<ThreadConfirmationConfig>;
}>;

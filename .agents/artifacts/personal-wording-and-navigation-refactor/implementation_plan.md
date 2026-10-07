# Kế Hoạch Chuyển Đổi Wording Quản Lý Cá Nhân & Tái Cấu Trúc Navigation

Chuyển đổi toàn bộ hệ thống từ ngữ (wording) từ phong cách **Kế toán / Doanh nghiệp** (`Công nợ`, `Đối tác`, `Khoản chi`, `Liên lạc`, `Số dư`) sang phong cách **Quản lý Cá nhân** (`Vay & cho vay`, `Người liên quan`, `Chi tiêu`, `Thu − Chi`, `Người khác nợ bạn`, `Bạn đang nợ`), đồng thời tái cấu trúc thanh điều hướng (`ReportsNavigation`) thành các nhóm danh mục trực quan và đồng bộ song ngữ `vi` & `en`.

---

## User Review Required

> [!IMPORTANT]
> **Các thay đổi cốt lõi về trải nghiệm người dùng (UX Copywriting)**:
>
> 1. **Dòng tiền (`dashboard.balance`)**: Đổi từ `"Số dư"` sang `"Thu − Chi"`. Tránh hiểu nhầm đây là số dư tài khoản ngân hàng thực tế, phản ánh chính xác công thức $Income - Expense$.
> 2. **Vay nợ (`debts`)**: Chuyển `"Công nợ"` $\rightarrow$ `"Vay & cho vay"`, `"Cần thu"` $\rightarrow$ `"Người khác nợ bạn"` (filter: `"Cho vay"`), `"Cần trả"` $\rightarrow$ `"Bạn đang nợ"` (filter: `"Đi vay"`).
> 3. **Người liên quan (`contacts`)**: Chuyển `"Liên lạc"` / `"Đối tác"` $\rightarrow$ `"Người liên quan"`.
> 4. **Chi tiêu (`expenses`)**: Chuyển `"Khoản chi"` $\rightarrow$ `"Chi tiêu"`.
> 5. **Tái cấu trúc Sidebar**: Phân nhóm thanh menu thành: **TỔNG QUAN**, **TÀI CHÍNH**, **KHÁC**.

---

## Proposed Changes

### 1. Shared Contracts & i18n Dictionary (`packages/contracts`)

#### [MODIFY] [index.ts](file:///Users/datdoan/Documents/projects/zalobot/packages/contracts/src/index.ts)

- Cập nhật từ điển `vi`:
  - `nav.home`: `'Tổng quan'`
  - `nav.statistics`: `'Phân tích'`
  - `nav.contacts`: `'Người liên quan'`
  - `nav.debts`: `'Vay & cho vay'`
  - `nav.expenses`: `'Chi tiêu'`
  - `nav.reports`: `'Tài chính'`
  - `nav.personalSpace`: `'Cá nhân'`
  - `nav.section.overview`: `'TỔNG QUAN'`
  - `nav.section.finance`: `'TÀI CHÍNH'`
  - `nav.section.other`: `'KHÁC'`
  - `dashboard.quickStats`: `'Tổng quan tài chính'`
  - `dashboard.welcome`: `'Xin chào'`
  - `dashboard.overviewSubtitle`: `'Tài chính, công việc và lịch trình của bạn'`
  - `dashboard.statisticsSubtitle`: `'Tổng quan tháng này'`
  - `dashboard.attentionItems`: `'Cần chú ý'`
  - `dashboard.thisMonthBalance`: `'Chênh lệch thu chi'`
  - `dashboard.receivableTotal`: `'Người khác nợ bạn'`
  - `dashboard.payableTotal`: `'Bạn đang nợ'`
  - `dashboard.netDebt`: `'Chênh lệch vay nợ'`
  - `dashboard.balance`: `'Thu − Chi'`
  - `dashboard.openDebts`: `'Vay & cho vay'`
  - `table.filter.receivable`: `'Cho vay'`
  - `table.filter.payable`: `'Đi vay'`
  - `dashboard.columns.counterparty`: `'Người liên quan'`
  - `dashboard.columns.remaining`: `'Còn lại'`
  - `dashboard.columns.original`: `'Ban đầu'`
  - `dashboard.columns.dueDate`: `'Ngày hẹn trả'`
  - `debts.title`: `'Vay & cho vay'`
  - `debts.subtitle`: `'Theo dõi tiền bạn cho mượn và tiền bạn đang vay'`
  - `expenses.title`: `'Chi tiêu'`
  - `expenses.subtitle`: `'Ăn uống, đi lại, mua sắm và các khoản chi khác'`
  - `contacts.title`: `'Người liên quan'`
  - `contacts.subtitle`: `'Những người có giao dịch vay, cho vay hoặc thu chi với bạn'`
- Cập nhật từ điển `en` tương ứng đảm bảo song ngữ hoàn chỉnh:
  - `nav.home`: `'Overview'`, `nav.statistics`: `'Analytics'`, `nav.contacts`: `'People'`, `nav.debts`: `'Loans & Debts'`, `nav.expenses`: `'Expenses'`, `nav.reports`: `'Finance'`
  - `dashboard.receivableTotal`: `'Others owe you'`, `dashboard.payableTotal`: `'You owe'`, `dashboard.netDebt`: `'Net loan balance'`, `dashboard.balance`: `'Income − Expense'`
  - `table.filter.receivable`: `'Lent'`, `table.filter.payable`: `'Borrowed'`
  - `debts.title`: `'Loans & Debts'`, `debts.subtitle`: `'Track money you lent and money you borrowed'`
  - `expenses.title`: `'Expenses'`, `expenses.subtitle`: `'Daily spending, shopping, dining and other expenses'`
  - `contacts.title`: `'People'`, `contacts.subtitle`: `'People with loan or spending transactions with you'`

---

### 2. Web Frontend (`apps/web`)

#### [MODIFY] [reports-navigation.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/shared/ui/reports-navigation.tsx)

- Tái cấu trúc menu sang dạng danh mục có tiêu đề nhóm (Section Groups):
  - **TỔNG QUAN**: Tổng quan (`APP_ROUTES.reports`)
  - **TÀI CHÍNH**: Chi tiêu (`APP_ROUTES.expenses`), Vay & cho vay (`APP_ROUTES.debts`), Phân tích (`APP_ROUTES.statistics`)
  - **KHÁC**: Người liên quan (`APP_ROUTES.contacts`)
- Giữ nguyên cơ chế chuyển đổi Theme (Sáng/Tối) và Language (Tiếng Việt/English).

#### [MODIFY] [dashboard-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/dashboard/view/dashboard-screen.tsx)

- Kiểm tra và đảm bảo các metric cards, table headers và action buttons sử dụng đúng các key mới cập nhật.

#### [MODIFY] [debts-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/debts/view/debts-screen.tsx)

- Kiểm tra và cập nhật filter buttons (`Cho vay` / `Đi vay`) cùng các metric cards hiển thị `Người khác nợ bạn` / `Bạn đang nợ`.

#### [MODIFY] [expenses-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/expenses/view/expenses-screen.tsx)

- Đồng bộ tiêu đề màn hình và các metric tổng chi.

#### [MODIFY] [contacts-screen.tsx](file:///Users/datdoan/Documents/projects/zalobot/apps/web/src/modules/contacts/view/contacts-screen.tsx)

- Đồng bộ tiêu đề "Người liên quan" và bảng dữ liệu.

---

### 3. zalo Bot (`apps/api`)

#### [MODIFY] [zalo-menu.catalog.ts](file:///Users/datdoan/Documents/projects/zalobot/apps/api/src/zalo/zalo-menu.catalog.ts)

- Cập nhật menu items trên bot:
  - `debts`: `label: '💳 Vay & cho vay'`, `commandDescription: 'Các khoản cho vay và đi vay đang mở'`
  - `finance`: `label: '💰 Thu chi'`, `commandDescription: 'Thu chi trong hôm nay'`
  - `dashboard`: `label: '📊 Tổng quan'`, `commandDescription: 'Tổng quan công việc, lịch và tài chính'`

---

### 4. Canonical Knowledge & Documentation Sync

#### [MODIFY] [knowledge/global/i18n.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/global/i18n.md)

- Cập nhật tài liệu canonical knowledge i18n theo quy chuẩn tiếng Anh ngắn gọn.

#### [MODIFY] [docs/global/i18n.md](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/global/i18n.md)

- Cập nhật tài liệu developer i18n theo quy chuẩn tiếng Việt.

---

## Verification Plan

### Automated Verification

1. **Linter & Typecheck**:
   ```bash
   npm run lint
   npm run typecheck
   ```
2. **System Validation**:
   ```bash
   npm run agent-system:validate
   ```
3. **Web Build Check**:
   ```bash
   npm run build --workspace=apps/web
   ```

### Manual Verification

- Chuyển đổi ngôn ngữ Tiếng Việt $\leftrightarrow$ English trên Web UI để kiểm tra không bị sót key hoặc vỡ layout.
- Kiểm tra giao diện Sidebar Navigation hiển thị đúng 3 nhóm: Tổng quan, Tài chính, Khác.
- Kiểm tra các màn hình: Dashboard, Chi tiêu, Vay & cho vay, Người liên quan.

# Walkthrough - Khắc phục Documentation Drift cho Module Dashboard

Đã cập nhật đồng bộ Canonical Knowledge và Developer Documentation tương ứng với thay đổi trong `apps/web/src/modules/dashboard/presentation/components/debt-allocation-modal.tsx`, vượt qua toàn bộ các bước kiểm tra của pre-commit hook.

## Thay đổi đã thực hiện

### 1. Canonical Knowledge (EN)

- **File**: [`.agents/knowledge/modules/dashboard/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/dashboard/README.md)
- **Nội dung**: Bổ sung chi tiết về việc sử dụng hằng số tĩnh `EMPTY_CANDIDATE_DEBTS` và `EMPTY_ALLOCATIONS` làm fallback cho `useCandidateDebtsQuery` và `useTransactionAllocationsQuery` trong `DebtAllocationModal` để ngăn chặn reference churn và re-render loops.

### 2. Developer Documentation (VI)

- **File**: [`.agents/docs/modules/dashboard/README.md`](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/dashboard/README.md)
- **Nội dung**: Cập nhật mục _Cơ chế chống treo render & Tối ưu hiệu năng Bảng dữ liệu_ giải thích cơ chế ổn định tham chiếu mảng fallback cho lập trình viên.

## Kết quả kiểm tra

### Pre-commit Verification

```bash
node scripts/agent-system/precommit/run.mjs
```

Kết quả:

```text
[agent-system] CHECK — 8/12 staged files affect the graph
[STARTED] npm run agent-system:validate -- --check-changes --check-i18n
[COMPLETED] npm run agent-system:validate -- --check-changes --check-i18n
[agent-system] PASS — metadata, links, imports, and graph snapshot are valid
```

Toàn bộ staged files đã sẵn sàng để commit thành công.

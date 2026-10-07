# Cập nhật Tài liệu Module Dashboard (Khắc phục Documentation Drift)

Khắc phục lỗi pre-commit hook do phát hiện thay đổi mã nguồn trong `apps/web/src/modules/dashboard/presentation/components/debt-allocation-modal.tsx` nhưng tài liệu Canonical Knowledge (`.agents/knowledge/modules/dashboard/README.md`) và Developer Documentation (`.agents/docs/modules/dashboard/README.md`) chưa được cập nhật tương ứng.

## User Review Required

> [!NOTE]
> Thay đổi này thuần túy đồng bộ tài liệu kỹ thuật và hướng dẫn lập trình viên, không thay đổi mã nguồn logic ứng dụng.

## Proposed Changes

Group files by component:

### Dashboard Module Documentation

Cập nhật tài liệu kỹ thuật mô tả tối ưu hóa tham chiếu mảng rỗng (`EMPTY_CANDIDATE_DEBTS`, `EMPTY_ALLOCATIONS`) trong `DebtAllocationModal` nhằm ngăn ngừa vòng lặp render và reference churn khi dữ liệu query chưa sẵn sàng.

#### [MODIFY] [README.md (Knowledge)](file:///Users/datdoan/Documents/projects/zalobot/.agents/knowledge/modules/dashboard/README.md)

- Bổ sung ghi chú về việc sử dụng hằng số tĩnh `EMPTY_CANDIDATE_DEBTS` và `EMPTY_ALLOCATIONS` làm fallback cho `useCandidateDebtsQuery` và `useTransactionAllocationsQuery` trong phần _High-performance Data Tables & Render Loop Prevention_.

#### [MODIFY] [README.md (Docs)](file:///Users/datdoan/Documents/projects/zalobot/.agents/docs/modules/dashboard/README.md)

- Bổ sung nội dung tiếng Việt vào mục _Cơ chế chống treo render & Tối ưu hiệu năng_ giải thích việc cố định tham chiếu mảng mặc định trong `DebtAllocationModal`.

## Verification Plan

### Automated Tests

- Chạy kiểm tra tính toàn vẹn hệ thống và đồng bộ tài liệu:
  ```bash
  npm run agent-system:validate -- --check-changes --check-i18n
  ```
- Đảm bảo pre-commit validation pass hoàn toàn 100%.

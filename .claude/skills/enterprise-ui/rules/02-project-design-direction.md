---
trigger: model_decision
description: Mandatory Project Design Profile constraint for enterprise-ui orchestration (Flat Enterprise + Data-Dense B2B SaaS + Excel-lite interaction).
metadata:
  agent-artifact:
    id: enterprise-ui-project-design-direction
    type: rule
    explanation: .agents/system-explain/plugins/enterprise-ui/rules/02-project-design-direction.md
    depends_on:
      - .claude/skills/enterprise-ui/rules/01-authority-and-hierarchy.md
---

# Project UI/UX Design Direction: Flat Enterprise & Data-Dense B2B SaaS

## 1. Core Principle: Product UI Orchestration Constraint

The `enterprise-ui` orchestrator MUST treat all application tasks as **Product UI / B2B SaaS / Admin / Data-Heavy Operations Applications**, NOT marketing landing pages.

```text
enterprise-ui (Orchestrator)
│
├── Project Design Profile (MANDATORY CONSTRAINT)
│   └── Flat Enterprise + Data-Dense B2B SaaS + Excel-lite Interaction
│
├── Tier 1: frontend-design-principles (Constrained to B2B product domain)
├── Tier 2: ui-design (Constrained to flat single-canvas, dense tables, subtle borders)
├── Tier 3: ui-audit (Audits 4 states, keyboard navigation, form flaws)
└── Tier 4: web-design-guidelines (Audits WCAG AA/AAA, contrast, focus rings)
```

> **Mandatory Constraint**: Upstream skills must NOT be modified, but the `enterprise-ui` orchestrator must apply this Project Design Profile as a non-negotiable filter. If an upstream skill suggests multiple aesthetic directions, the agent MUST select the B2B SaaS / Data-dense operational path and reject marketing/creative/bento alternatives.

---

## 2. Aesthetic Priorities vs Anti-Patterns

### ✅ Ưu Tiên Tuyệt Đối:
- **Data first**: Dữ liệu và tác vụ vận hành là trung tâm, tối thiểu hóa chi tiết trang trí thừa.
- **Dense**: Mật độ thông tin cao, phục vụ người dùng quét nhanh hàng chục/hàng trăm bản ghi.
- **Flat Single Canvas**: Một workspace liền mạch (`Page -> Header -> Toolbar -> Main Data Surface -> Footer`), tránh bọc thẻ lồng thẻ (`Card -> Card -> Card -> Table`).
- **Neutral**: Màu nền trung tính tự nhiên (`slate-50`, `white`, `zinc-900`), viền mảnh 1px (`border-slate-200` / `border-slate-800`).
- **Border over Shadow**: Dùng viền 1px tinh tế thay cho drop shadow lớn hoặc glassmorphism blur. Chỉ dùng `shadow-sm` cho popover/dropdown/dialog.
- **Controlled Radius**: Bo góc nhỏ và có kiểm soát (`rounded-md`, `rounded-sm`). Không dùng `rounded-2xl` / `rounded-3xl`.
- **Fast to Scan & Operate**: Typography phục vụ việc scan (Primary: `text-sm font-medium`, Secondary: `text-xs text-muted-foreground`, Mono cho technical IDs/hashes).
- **Excel-lite Interaction**: Bảng dữ liệu tương tác linh hoạt, scan nhanh, hỗ trợ phím. **Editable cell ở trạng thái idle phải nhìn như text thường (transparent border/bg), chỉ hiện border/input khi hover/focus**.
- **Actions Noise Reduction**: Gom gọn các thao tác phụ vào menu `...` (More Actions), tránh hiển thị 4-5 nút bấm trên mỗi dòng.
- **No Header Emojis**: Không chèn emoji vào tiêu đề cột của bảng dữ liệu.

### ❌ Anti-Patterns Bắt Buộc Loại Bỏ (Design Regressions):
- Bento grids hoặc marketing card compositions.
- Decorative cards, oversized illustrations, cute dashboard graphics.
- Khoảng trắng khổng lồ (large empty space) để "trông premium".
- Gradient rực rỡ, glassmorphism blur, neumorphism, floating surfaces.
- Lạm dụng badge/pill cho mọi metadata (hãy dùng phân cấp text + status dot `●`).
- Table header màu tối nặng nề hoặc có icon/emoji trang trí.

---

## 3. Data Table Standards (Excel-lite)

| Thành Phần | Quy Chuẩn Kích Thước & Kiểu Dáng | Ghi Chú |
| :--- | :--- | :--- |
| **Table Header** | Cao 36–40px, nền neutral nhạt, border-b 1px, text-xs uppercase/medium | Tuyệt đối không emoji |
| **Default Row** | Cao 40–48px (compact), hover highlight nhẹ (`bg-accent/40`) | Không shadow, không card per row |
| **Two-line Row** | Tối đa 52–56px cho các cell có metadata phụ | Giữ thẳng hàng dọc |
| **Toolbar** | Gắn liền với bề mặt dữ liệu (Search + Filters + Batch Actions + Columns) | Cùng chiều cao (32-36px), không tạo card tách rời |
| **Editable Cells** | Idle: transparent; Hover: subtle border; Focus: distinct ring | Không render input box thô cứng khi idle |
| **Row Actions** | 1 primary action nếu cần + menu dropdown `...` cho các action còn lại | Giảm tối đa visual noise |

---

## 4. Design Acceptance Checklist

Trước khi kết luận UI task hoàn thành, Agent phải tự kiểm tra 10 câu hỏi:
1. Người dùng có nhìn thấy **data/content trước decoration** không?
2. Có card nào tồn tại chỉ để bọc một section khác không?
3. Có whitespace/padding nào lớn hơn nhu cầu thao tác không?
4. Có badge nào có thể thay bằng text hierarchy hoặc status dot không?
5. Có action nào nên đưa vào `...` menu không?
6. Table có đủ dense để scan nhiều records không?
7. Editable cell có đang nhìn giống form controls thô cứng khi idle không?
8. Border/shadow/radius có đang quá nổi hơn content không?
9. Semantic color có thực sự mang ý nghĩa (Green/Amber/Red/Blue) không?
10. UI có mang cảm giác operational software chuẩn B2B SaaS hay đang giống template dashboard?

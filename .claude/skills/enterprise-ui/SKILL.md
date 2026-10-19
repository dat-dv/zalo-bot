---
name: enterprise-ui
description: Master Enterprise UI/UX Orchestration skill unifying frontend design principles, component implementation craft, pre-ship UI auditing, and web interface standards in a strict 4-tier hierarchy.
metadata:
  agent-artifact:
    id: enterprise-ui-skill
    type: skill
    explanation: .agents/system-explain/plugins/enterprise-ui/skills/README.md
    depends_on:
      - .claude/skills/enterprise-ui/rules/01-authority-and-hierarchy.md
      - .claude/skills/enterprise-ui/rules/02-project-design-direction.md
---

> **zalo-bot adaptation** (vendored from Base Agents plugin `enterprise-ui`; project conventions override generic defaults below)
>
> - Project design direction is canonical in `.agents/knowledge/global/web-ui-direction.md` (data-dense, full-width shared `data-table` with `STT` + `ID` columns, resizable/toggleable columns, dark/light, money visibility toggle, skeletons matching final layout). It overrides generic aesthetics here.
> - All user-facing text via i18n (`vi` + `en`). Tailwind v4, no shadcn/framer-motion installed — don't add UI kits without an approved plan.

# Enterprise UI/UX Master Orchestrator

The `enterprise-ui` plugin provides a unified, production-grade UI/UX engineering system by orchestrating 4 curated upstream open-source skills while enforcing the project's non-negotiable **Product UI Design Direction**.

## 1. Architecture & Master Orchestration Constraint

```text
enterprise-ui (Orchestrator)
│
├── Project Design Profile (MANDATORY CONSTRAINT)
│   └── Flat Enterprise / Data-Dense / Excel-lite
│
├── Tier 1: frontend-design-principles (joshuadavidthomas/agent-skills)
├── Tier 2: ui-design (mblode/agent-skills)
├── Tier 3: ui-audit (mblode/agent-skills)
└── Tier 4: web-design-guidelines (vercel-labs/agent-skills)
```

> **Mandatory Orchestration Constraint**: Bốn upstream skills vẫn giữ nguyên nội dung của tác giả và không bị rewrite. Tuy nhiên, khi `enterprise-ui` orchestration các upstream skills, **Project Design Profile bên dưới là constraint bắt buộc**. Không được để upstream skills tự chọn một aesthetic trái với product direction của project. Nếu một upstream skill đề xuất nhiều aesthetic direction khác nhau, Agent BẮT BUỘC phải chọn nhánh B2B SaaS / Data-dense operational workspace và từ chối các hướng Marketing / Creative / Bento.

---

## 2. Project UI/UX Design Direction

Plugin `enterprise-ui` định nghĩa toàn bộ ứng dụng là **product UI / B2B SaaS / admin / data-heavy application**, không phải marketing website.

Phong cách mặc định của project là:

> **Flat Enterprise + Data-Dense B2B SaaS + Excel-lite interaction**

### Ưu tiên:
```text
Data first
Dense
Flat
Neutral
Fast to scan
Fast to operate
Professional
Predictable
Minimal decoration
```

### Không ưu tiên:
```text
Bento
Marketing aesthetic
Decorative cards
Large empty space
Oversized headings
Gradient
Glassmorphism
Neumorphism
Floating surfaces
Excessive shadows
Excessive pills/badges
Cute dashboard aesthetic
```

---

## 3. Detailed Design Principles (15 Non-Negotiables)

### 1. Product UI, không phải landing page
Khi task thuộc: dashboard, admin, crawler, account management, campaign management, data table, logs, monitoring, configuration, form, internal tool, operational workflow -> phải ưu tiên **application workspace**.
- Không tự áp dụng: hero section, bento grid, marketing card composition, oversized illustration, decorative statistics cards, large whitespace để "trông premium", gradient/glow tạo điểm nhấn.
- UI phải phục vụ thao tác trước, decoration sau.

### 2. Single Canvas / Flat Surface
Ưu tiên một workspace liền mạch:
```text
Page
│
├── Page Header
│
├── Toolbar
│
├── Main Data Surface
│   ├── Header
│   ├── Rows / Content
│   └── Footer
│
└── Side panel / dialog khi thật sự cần
```
- Tránh: `Card -> Card -> Card -> Table`.
- Không bọc mọi section bằng card. Chỉ tạo surface riêng khi nó thực sự thể hiện một vùng chức năng khác biệt.

### 3. Border thay cho Shadow
- Ưu tiên: `1px subtle border`, `neutral background`, `small radius` (`border-slate-200`, `border-slate-100`, `bg-white`, `bg-slate-50`).
- Shadow nếu có chỉ dùng `shadow-sm` và chỉ khi thực sự cần phân tách layer như: dropdown, popover, floating menu, dialog. Không dùng heavy shadow cho page sections.

### 4. Border Radius nhỏ và có kiểm soát
- Không tự động dùng `rounded-xl`, `rounded-2xl`, `rounded-3xl` cho mọi thứ.
- Default: `rounded-md` hoặc `rounded-lg`. Với data-heavy controls/table có thể nhỏ hơn (`rounded-sm`). Không biến dashboard thành tập hợp các "bubble cards".

### 5. Data density cao nhưng vẫn đọc được
Đây là operational software, người dùng cần xem nhiều records trên cùng màn hình.
- Ưu tiên: compact controls, compact toolbar, compact rows, clear hierarchy, minimum unnecessary padding.
- Chuẩn table:
  - Header: khoảng **36–40px**
  - Default row: khoảng **40–48px**
  - Two-line row: tối đa khoảng **52–56px**
- Không tự tạo row 80–100px nếu dữ liệu chỉ có một vài field.

### 6. Typography hierarchy
Typography phải phục vụ việc scan data:
- Primary: `text-sm font-medium text-slate-900`
- Normal: `text-sm text-slate-700`
- Secondary / metadata: `text-xs text-slate-500`
- ID / code / hash / technical value: dùng font mono (`font-mono`) khi giúp scan dữ liệu.
- Không dùng heading quá lớn, không decorative font, không excessive bold, không uppercase hàng loạt.

### 7. Color phải mang ý nghĩa
- Base UI ưu tiên neutral: `slate`, `zinc`, `neutral`, `white`.
- Semantic color chỉ dùng khi có ý nghĩa:
  - `green` → success / healthy
  - `amber` → warning
  - `red` → error / destructive
  - `blue` → selected / focus / primary interaction
- Không dùng nhiều màu chỉ để trang trí.

### 8. Không badge hóa mọi thứ
Không biến mọi metadata thành pill badge.
- Tránh: `[Facebook] [Active] [Session Saved] [Production]` tràn lan.
- Ưu tiên: Phân cấp text sạch + status dot (`● Hoạt động`).
- Badge/pill chỉ dành cho: exception, warning, error, checkpoint, special state hoặc category thực sự cần nhận diện nhanh.

### 9. Toolbar phải gắn với workspace
Toolbar nên là một phần của data surface:
```text
Search | Filters | Context Actions        Columns | More
─────────────────────────────────────────────────────────
Data
```
- Không tạo một card riêng chỉ để chứa search/filter nếu nó thuộc cùng một workflow.
- Controls phải: compact (h-8 / 32px), cùng chiều cao, alignment rõ, không dư padding, không nhiều button màu primary cạnh nhau.

### 10. Actions phải giảm visual noise
Không render hàng loạt action button trong mỗi row (tránh `Login | Check | Start | Edit | Delete`).
- Ưu tiên: Nút `...` mở menu More Actions (`Open profile`, `Check health`, `Start / Stop`, `Edit`, `Delete`).
- Primary row action chỉ hiển thị riêng nếu thực sự được dùng rất thường xuyên.

### 11. Table phải mang cảm giác Excel-lite
- Bảng dữ liệu: dense, aligned, scan-friendly, keyboard-friendly, editable-without-looking-like-a-form.
- Header: light neutral background, subtle border, text nhỏ, không dark/black header mặc định, không emoji trong header.
- Rows: subtle horizontal/vertical divider, hover nhẹ, selected nhẹ, không shadow, không card per row.

### 12. Editable table không được nhìn như một form
- Các helper `renderInput`, `renderSelect`, `renderCheckbox`, `renderDate` khi idle phải gần giống read-only cell:
  - `idle` → transparent background, transparent border
  - `hover` → border nhẹ
  - `focus` → focus ring rõ
- **Nguyên tắc cốt lõi**: Editable cell chỉ nên "lộ" tính editable khi hover/focus.

### 13. Table header không dùng emoji
- Tuyệt đối không dùng emoji trong header (`👤 Tài khoản`, `🆔 External ID`, `🟢 Trạng thái`).
- Ưu tiên text sạch (`Tài khoản`, `External ID`, `Trạng thái`).

### 14. Responsive theo application workflow
- Desktop: full data workspace.
- Smaller viewport: ẩn cột không quan trọng, horizontal scroll mượt mà, responsive toolbar. Không ép desktop data table thành card list chỉ để gọi là responsive.

### 15. Inspiration
Tham khảo tinh thần: **Linear, GitHub, Vercel dashboards, Datadog, Notion database, Cloud consoles**.
- Điểm chung: High information density, neutral surfaces, subtle separators, clear interaction states, fast scanning, minimal decoration.

---

## 4. Four-Tier Execution Workflow

### Phase A: Direction Authority (`frontend-design-principles`)
1. Lọc định hướng qua Project Design Profile (chọn B2B SaaS / App, reject Marketing / Bento).
2. Thiết lập token màu tự nhiên (Calibrated Zinc/Slate), độ sáng HSL động cho Light/Dark mode.

### Phase B: Implementation Craft (`ui-design`)
1. Hiện thực hóa giao diện React / Next.js / Tailwind CSS.
2. Áp dụng Single Canvas, 1px subtle border, bo góc nhỏ (`rounded-md` / `rounded-sm`), table dense 36-40px header, 40-48px rows.
3. Áp dụng Excel-lite editable cells (idle transparent, hover/focus visible).
4. Gom gọn actions vào menu `...`.

### Phase C: Quality Audit (`ui-audit`)
1. Kiểm toán đầy đủ **4 trạng thái UI (4 States)**:
   - **Loading**: Dense skeleton matching row height, không CLS.
   - **Error**: Alert gọn gàng kèm nút Retry.
   - **Empty**: Tối giản với CTA rõ ràng, không hình cartoon lớn.
   - **Success**: Dữ liệu hiển thị chuẩn, status dot hoạt động.
2. Kiểm tra tương tác bàn phím và phản hồi form.

### Phase D: Standards & Accessibility Gate (`web-design-guidelines`)
1. Kiểm chuẩn WCAG 2.1 AA/AAA: Contrast ratio >= 4.5:1 cho text thường, >= 3:1 cho large text & controls.
2. Kiểm tra focus rings `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.
3. Kiểm tra semantic HTML & ARIA roles (`role="status"`, `role="alert"`, `aria-busy="true"`).
4. Touch target >= 44px (desktop) / 48px (mobile).

---

## 5. Design Acceptance Test

Trước khi kết luận UI task hoàn thành, Agent phải tự kiểm tra 10 câu hỏi:
1. Người dùng có nhìn thấy **data/content trước decoration** không?
2. Có card nào tồn tại chỉ để bọc một section khác không?
3. Có whitespace/padding nào lớn hơn nhu cầu thao tác không?
4. Có badge nào có thể thay bằng text hierarchy hoặc status dot không?
5. Có action nào nên đưa vào `...` menu không?
6. Table có đủ dense để scan nhiều records không?
7. Editable cell có đang nhìn giống form controls thô cứng khi idle không?
8. Border/shadow/radius có đang quá nổi hơn content không?
9. Semantic color có thực sự mang ý nghĩa không?
10. UI có mang cảm giác operational software hay đang giống template dashboard?

---
name: ui-audit
description: Pre-ship UI/UX audit for React, Next.js, and Tailwind codebases. Audits built frontends for state gaps, interaction failures, keyboard/focus flaws, form errors, and layout defects with file:line findings and a ship verdict.
metadata:
  source: mblode/agent-skills
  version: "1.0.0"
---

# UI Audit

Exhaustively audit built React, Next.js, and Tailwind interfaces for user-facing defects, state gaps, accessibility flaws, and UX failures before shipping.

## Core Responsibilities

- **Audit Target**: Review changed files, views (`presentation/views/`), or atomic components.
- **Rule Verification**: Inspect code against 50+ battle-tested failure-mode rules (states, forms, focus, layout, a11y).
- **Actionable Reporting**: Deliver findings in strict `file:line` format with code remediation and a definitive **Ship Verdict**.

---

## 1. Audit Categories & Checkpoints

### A. State Completeness (4 UI States)
- [ ] **Loading State**: Every async operation, server fetch, or mutation displays an appropriate skeleton or spinner.
- [ ] **Error State**: Graceful error boundary fallback or error banner with retry capability; no unhandled promise rejections or white screens.
- [ ] **Empty State**: Clear empty message with call-to-action when lists, tables, or search results return 0 items.
- [ ] **Success State**: Clear feedback on successful mutations without data desynchronization.

### B. Keyboard Navigation & Focus Management
- [ ] **Focus Trapping**: Modals, dialogs, and drawer sheets trap focus while open.
- [ ] **Focus Restoration**: Focus returns to the triggering element when a modal or popover closes.
- [ ] **Escape Key**: All overlays, modals, and dropdowns close on `Escape`.
- [ ] **Tab Order**: Natural reading and tab navigation order across interactive elements.

### C. Forms & User Input Safety
- [ ] **Inline Error Association**: Every error message is linked to its input via `aria-describedby` or `aria-errormessage`.
- [ ] **Data Preservation**: User inputs are NEVER cleared or lost when a form submission fails with server errors.
- [ ] **Double Submission Prevention**: Submit buttons indicate loading state and disable multiple concurrent submissions.
- [ ] **Auto-complete**: Form inputs provide proper `autocomplete` and `name` attributes.

### D. Layout Resilience & Mobile Ergonomics
- [ ] **Viewport Fit**: No horizontal page scrolling or unintended overflow on small screens (< 375px).
- [ ] **Tap Targets**: All touchable buttons, links, and inputs meet minimum 44x44px touch targets.
- [ ] **Text Truncation**: Long strings, dynamic names, and localized text wrap cleanly or truncate with tooltips.

### E. Accessibility (a11y) Foundations
- [ ] **Semantic HTML**: Buttons use `<button>`, links use `<a>`, headers follow logical `<h1>`-`<h6>` hierarchy.
- [ ] **Icon Buttons**: Icon-only buttons include `aria-label` or visually hidden text.
- [ ] **Image Alt Text**: Informative images have descriptive `alt` text; decorative images have `alt=""`.
- [ ] **Color Contrast**: Text meets minimum WCAG AA contrast ratio (4.5:1 for normal text, 3:1 for large text).
- [ ] **Color-Only Signals**: Critical states (errors, status badges) combine color with icons or descriptive text.

---

## 2. Audit Output Format

When performing an audit, format the report as follows:

```markdown
# UI Audit Report: [Target Component / View]

## Verdict: [PASS | WARN | BLOCKED]

### Critical Issues (Must fix before shipping)
- `src/components/modal.tsx:42`: Missing `aria-label` on icon-only close button in modal header.
  - **Fix**: Add `aria-label="Đóng"` to `<button>`.

### High Priority (UX / State gaps)
- `src/modules/products/presentation/views/product-list-view.tsx:85`: Table view does not render an Empty state when `data.length === 0`.
  - **Fix**: Render `<EmptyState title="Không có dữ liệu" />` when list is empty.

### Minor / Polish Recommendations
- `src/components/atoms/button.tsx:120`: Button touch target is 32px on mobile screens.
  - **Fix**: Add `min-h-[44px] min-w-[44px]` for mobile viewports.
```

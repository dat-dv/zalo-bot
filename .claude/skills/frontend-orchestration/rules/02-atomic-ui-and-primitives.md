---
trigger: model_decision
description: Common UI vs Module UI partitioning, Atomic design hierarchy, mandatory reuse of shared UI primitives (Shadcn UI Atoms), 4 UI States, a11y standards, component decomposition, and enterprise-ui coordination.
metadata:
  agent-artifact:
    id: frontend-orchestration-rule-02
    type: rule
    explanation: .agents/system-explain/plugins/frontend-orchestration/rules/02-atomic-ui-and-primitives.md
    depends_on:
      - .claude/skills/frontend-orchestration/rules/01-architecture-and-ddd.md
---

# Atomic Design, Common vs Module UI Partitioning, & Component Discipline Rules

## 1. Common UI vs Feature Module UI Boundary Matrix

Frontend components MUST be partitioned into either the **App-Wide Common UI Layer** or **Feature Module UI Layer**:

| UI Layer | Directory Location | Scope & Purpose | Examples |
|---|---|---|---|
| **Level 1: Atoms** | `src/components/atoms/` (or `src/components/ui/`) | Generic primitives built on **Shadcn UI / Radix**. Zero business logic. | `button.tsx`, `input.tsx`, `label.tsx`, `badge.tsx`, `skeleton.tsx`, `dialog.tsx` |
| **Level 2: Molecules** | `src/components/molecules/` | Reusable multi-atom composables shared across features. | `form-field.tsx` (Label + Input + ErrorText), `search-input.tsx`, `theme-toggle.tsx` |
| **Level 3: Shared Organisms** | `src/components/organisms/` | Domain-agnostic complex UI sections used app-wide. | `data-table.tsx`, `stat-card.tsx`, `main-header.tsx`, `app-sidebar.tsx` |
| **Level 3: Feature Organisms** | `src/modules/<feature>/presentation/components/` | Domain-specific UI sections belonging strictly to a single feature context. | `<feature>-card.tsx`, `<feature>-filter-bar.tsx`, `<feature>-stats.tsx` |
| **Level 4: Feature Views** | `src/modules/<feature>/presentation/views/` | Screen Controllers (`'use client'`) managing state, forms, and 4 UI States. | `<feature>-list-view.tsx`, `<feature>-detail-view.tsx` |
| **Level 4: Feature Modals** | `src/modules/<feature>/presentation/modals/` | Feature-specific dialogs / drawer workflows. | `create-<feature>-modal.tsx`, `delete-<feature>-modal.tsx` |

## 2. RULE-03: Shadcn UI Primitives as Level 1 Atoms Constraint

- **RULE-03 (Shadcn UI Primitives as Level 1 Atoms)**: Feature modules **MUST NOT USE RAW INTERACTIVE HTML TAGS** (`<button>`, `<input>`, `<select>`, `<textarea>`).
- **MANDATORY**: Always import and reuse approved UI Primitives from Level 1 Atoms (`src/components/atoms/` or `@/components/atoms/`, e.g. `Button`, `Input`, `Badge`, `Card`, `Skeleton`, `Dialog`).
- Standard layout tags (`div`, `section`, `span`, `header`, `footer`, `main`, `aside`) remain permitted.

## 3. Mandatory 4 UI States in Screen Controller Views (Level 4)

Screen Controller Views in `src/modules/<feature>/presentation/views/` MUST handle and render all **4 UI States**:

1. **Loading State**: Display clean Skeleton components (`src/components/atoms/skeleton.tsx`) or progressive loading indicators while async requests are pending.
2. **Error State**: Render clear, user-friendly error messages with actionable retry mechanisms (`onRetry`).
3. **Empty State**: Render friendly empty graphics/icons with actionable Call-To-Action (CTA) buttons when dataset is empty.
4. **Success State**: Render the complete interactive data view and presentation organisms.

## 4. Strict Component Decomposition & Icon Discipline

- **Maximum Component Length (80-100 lines)**: Individual TSX/JSX component files MUST NOT exceed 80-100 lines. Complex UI sections (e.g., Auth Panels, Hero Showcase, Bento Grids, Complex Forms, Modals) MUST be decomposed into modular sub-components inside a dedicated folder (e.g., `presentation/components/<feature>-brand-panel/brand-header.tsx`, `bento-grid.tsx`).
- **Forbidden Inline SVG Dumping**: Feature modules MUST NOT dump raw, multi-line `<svg>` markup inline throughout layout components. Extract raw icons into dedicated icon primitives (`src/components/icons/...`) or use standard icon libraries (e.g., Lucide React).
- **Single Responsibility Component Seams**: Each sub-component MUST own a single visual or logical concern. Never output a monolithic 150+ line JSX blob in a single file.

## 5. Accessibility (a11y) Essentials

- **Interactive Labels**: All icon-only buttons MUST include an `aria-label` attribute (e.g., `<Button aria-label="Close dialog"><X className="h-4 w-4" /></Button>`).
- **Keyboard Navigation**: Dialogs, dropdowns, and interactive modals must support keyboard navigation (`Escape` to close, `Tab` focus trap).
- **Focus Indicators**: Ensure visible focus rings (`focus-visible:ring-2`) on all interactive primitives.

## 6. Visual Design Polish & Enterprise UI Coordination

When designing hero layouts, dashboards, or showcase views:
- Delegate visual styling and aesthetic guidelines to `.claude/skills/enterprise-ui/` (design principles, component craft, pre-ship audits, and web interface standards).
- **CRITICAL BOUNDARY**: Even when applying Enterprise UI visual aesthetics, agents MUST adhere to Rule 4 above (decompose cards into modular sub-components `< 80-100` lines/file).


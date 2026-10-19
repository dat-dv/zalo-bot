---
trigger: model_decision
description: Strict 4-tier UI/UX authority hierarchy and execution order for enterprise-ui capabilities (frontend-design-principles -> ui-design -> ui-audit -> web-design-guidelines).
metadata:
  agent-artifact:
    id: enterprise-ui-authority-and-hierarchy
    type: rule
    explanation: .agents/system-explain/plugins/enterprise-ui/rules/01-authority-and-hierarchy.md
    depends_on:
      - .agents/rules/core.md
---

# Enterprise UI/UX Authority Hierarchy & Orchestration Rules

## 1. Core Principle: 4-Tier Authority Chain

To prevent multiple UI/UX skills from conflicting or competing for visual direction, all UI engineering tasks under `enterprise-ui` MUST follow a strict 4-tier execution hierarchy:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Tier 1: Direction Authority                                             │
│ frontend-design-principles (joshuadavidthomas/agent-skills)            │
│ • Determines domain vocabulary, color world, typography thesis, and    │
│   signature element. Rejects generic AI defaults before coding.        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Direction established)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Tier 2: Implementation & Refinement                                    │
│ ui-design (mblode/agent-skills)                                        │
│ • Implements markup and components in React / Next.js / Tailwind CSS.  │
│ • Handles responsive layouts, dark-mode retrofits, componentization.   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (UI built)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Tier 3: Quality Audit & Defect Hunting                                 │
│ ui-audit (mblode/agent-skills)                                         │
│ • Pre-ship audit scanning for state gaps (Loading/Error/Empty/Success),│
│   interaction failures, form flaws, and layout resilience.             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Defects addressed)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Tier 4: Final Standards & Accessibility Check                          │
│ web-design-guidelines (vercel-labs/agent-skills)                       │
│ • Final conformance check against Web Interface Guidelines,            │
│   WCAG AA/AAA accessibility, keyboard navigation, and focus rings.    │
└────────────────────────────────────────────────────────────────────────┘
```

## 2. Capability Boundaries & Collision Prevention

1. **Design Direction Collision**: When deciding brand identity, mood, color palette, or typography hierarchy, `frontend-design-principles` holds exclusive primary authority. `ui-design` must conform to the established direction rather than inventing competing themes.
2. **Implementation Scope**: `ui-design` executes code implementation within established component boundaries (< 80-100 lines/file, clean Tailwind tokens, zero raw inline SVG dumping).
3. **Review & Audit Scope**: `ui-audit` and `web-design-guidelines` are inspection and verification skills. They produce actionable `file:line` findings and must not silently alter the fundamental design direction.

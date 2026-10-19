# Project Knowledge Base (Agent-Facing)

This directory is the canonical, agent-facing source of project knowledge. To optimize LLM token consumption (~30-40% savings) while preserving technical precision, ALL files under `.agents/knowledge/` are written strictly in **concise English**.

## Structure

```
.agents/knowledge/
├── README.md                              # Knowledge index and architectural mapping
├── project-overview.md                    # High-level project goals, business domain, and scope
├── global/                                # Project-wide rules, invariants, architecture, and backend areas
│   ├── README.md                          # Index of global documents
│   ├── financial-report-contracts.md      # Finance report/analytics contracts (moved from former domain/)
│   └── <topic>.md                         # e.g. backend-crud-api, environment-guard, monorepo-architecture
└── modules/                               # FEATURE MODULES (Exact Codebase Module Mirroring)
    └── <module-name>/                     # Exact web module name from apps/web/src/modules/<module-name>
        └── README.md                      # Module spec: Business Purpose & API rationale, Responsive UI/UX, Business logic, Integration seams
```

There is no `domain/` folder; cross-cutting domain contracts live in `global/`.

## Module vs Global Placement

- `modules/<module-name>/` mirrors a web module folder `apps/web/src/modules/<module-name>/` (current modules: `auth`, `calendar`, `contacts`, `dashboard`, `debts`, `expenses`, `reminders`, `settings`, `tasks`, `users`, `zca`). Do NOT invent alternate folder names.
- The API (`apps/api/src/`) is organized by top-level areas (`finance`, `zalo`, `zca`, `google`, `llm`, `reminders`, `reports`, `users`, `ocr`, `receipt-storage`, `redis`, `health`, `audit`, `common`, `config`, `database`), not `modules/<name>`. Backend areas are documented under `global/` (e.g. `global/backend-crud-api.md`) or inside the web module they serve.

## Guidelines

- **Token Optimization**: Write in **concise English** to save context window tokens when loaded into LLM prompts.
- **Module Specification Requirements**: Each module document MUST specify:
  - **Business Purpose & API Rationale**: Why specific APIs exist and what business goals they achieve.
  - **UI/UX & Responsive Requirements**: Layout rules (desktop grid vs mobile stack), mandatory action buttons, dynamic interactive states.
  - **Business Logic & State Transitions**: Mandatory invariants, validation rules, state machines.
  - **Integration Seams**: Database schema, DTO contracts, hooks, and external events.
- **Human Mirror**: Every knowledge document has a Vietnamese developer explanation at the same relative path under `.agents/docs/`.
- **Keep Fresh**: Update canonical knowledge whenever intended business behavior, module UI requirements, or API contracts change. Validate with `node .claude/hooks/docs-drift-check.mjs --all`.

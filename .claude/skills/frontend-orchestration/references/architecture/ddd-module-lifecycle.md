# 4-Tier DDD Module Lifecycle & Boundary Enforcement

Frontend applications are organized into Domain-Driven Design (DDD) bounded contexts to guarantee modularity, prevent cross-feature coupling, and ensure long-term maintainability.

## 1. Directory Anatomy (`src/modules/<feature>/`)

Each feature module is organized into 4 distinct layers:

```text
src/modules/<feature>/
├── domain/                      # Pure Business Rules & Domain Models
│   ├── <feature>-types.ts       # Domain entity interfaces and value objects
│   └── <feature>-schemas.ts     # Zod form validation schemas
├── application/                 # Use Cases, Custom Hooks, & State Logic
│   ├── hooks/                   # Application custom hooks (e.g. use<Feature>List)
│   └── use-cases/               # Orchestration workflows & client business logic
├── infrastructure/              # External Communication & Data Transformers
│   ├── mappers/                 # Zod DTO-to-ViewModel transformers
│   └── repositories/            # I<Feature>Repository implementations (HTTP / Storage)
└── presentation/                # UI Presentation Components
    ├── components/              # Level 2 Molecules & Level 3 Organisms
    └── views/                   # Level 4 Screen Controller Views ('use client')
```

## 2. Shared Kernel vs Feature Module Partitioning

| Aspect | Common Shared Kernel (`src/shared/`, `src/components/`) | Feature Module (`src/modules/<feature>/`) |
|---|---|---|
| **Scope** | App-wide cross-cutting concerns | Isolated to one specific business capability |
| **Components** | Shared Atoms & generic Molecules (Buttons, Dialog, Header) | Feature-specific Views, Forms, Table Organisms |
| **Business Logic**| **STRICTLY ZERO** feature-specific business rules | Owns all feature business rules, mappers, and forms |
| **Dependencies** | Cannot depend on any `src/modules/*` | May consume `src/shared/*` and `src/components/*` |

## 3. Strict Boundary Rules

- **RULE-01 (Transport DTO Isolation)**: Never pass raw backend DTOs directly to Presentation Views or Components. All backend responses MUST pass through Infrastructure Mappers before reaching UI.
- **RULE-02 (Domain Pureness)**: Domain types and entity models (`domain/`) MUST NOT import UI frameworks (React, JSX), HTTP clients (Axios), or UI state libraries (Zustand).
- **RULE-04 (Cross-Module Isolation)**: A feature module `src/modules/foo/` MUST NEVER reach into internal private files of `src/modules/bar/`. Shared abstractions belong in `src/shared/` or `@shared/contracts`.

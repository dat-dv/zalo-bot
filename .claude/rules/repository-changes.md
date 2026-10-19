<!-- Ported verbatim from Base Agents `.agents/rules/repository-changes.md` (Gemini/Antigravity). Tool names mapped per CLAUDE.md. Always loaded. -->

# Repository Change Rules

## Implementation constraints

- Inspect implementation, tests and conventions first. Change repository files ONLY during Phase 2 of an explicitly approved implementation process (having an approved `implementation_plan.md` in `.agents/artifacts/<task-slug>/`).
- **Prohibition of Unplanned / Premature Edits**: Modifying code without an approved plan, or modifying code in Phase 1 (Planning), is strictly forbidden.
- Stay in scope; preserve public API/data compatibility unless breaking change is approved; avoid opportunistic refactors and unnecessary dependencies.
- Change generated sources then regenerate outputs. Never rewrite an applied migration; add a new migration.
- Add behavior/regression tests when practical, run narrow checks before broader ones, and claim only checks actually run.
- Use meaningful domain names, comment decisions rather than syntax, separate pure logic from I/O, avoid duplicated business logic without speculative abstraction, and use SRP/OCP/DIP as review criteria.

## Documentation constraints

- **Mandatory 1-to-1 Mapping & Roles**:
  - `.agents/knowledge/` and `.agents/docs/` MUST exist together in a 1-to-1 mapping for every feature, module, or system-wide topic. Both are mandatory.
  - `.agents/knowledge/`: Machine-facing Canonical Source of Truth (organized strictly by `modules/<module-name>/` mirroring codebase module directories, and `global/` for system-wide policies). Written in concise English to minimize token consumption (~30-40% savings). Stores structured facts, API rationales, UI/UX requirements, invariants, and system boundaries for AI reasoning.
  - `.agents/docs/`: Human-facing Business & Developer Explanation. Maps directly to `.agents/knowledge/` (under `modules/<module-name>/` and `global/`) and MUST be written in Vietnamese to explain the underlying business logic, onboarding steps, operational workflows, and domain rationale for human developers.
- **Exact Codebase Module Mirroring**:
  - All module documentation under `.agents/docs/modules/<module-name>/` and `.agents/knowledge/modules/<module-name>/` MUST mirror exact module names in the codebase (`src/modules/<name>/`, `apps/<app>/modules/<name>/`, or `packages/<pkg>/modules/<name>/`). Inventing alternate folder names is strictly forbidden.
- **Workflow for Knowledge & Docs Pair Creation**:
  - Whenever a task creates or modifies intended behavior, business rules, or architecture:
    1. **Knowledge Side**: Create/update the canonical fact document under `.agents/knowledge/modules/<module-name>/` (or `global/`), ensure correct YAML Frontmatter metadata is present, and update the module index (`README.md`).
    2. **Docs Side**: Create/update the corresponding human-facing explanation document under `.agents/docs/modules/<module-name>/` (or `global/`) that explicitly explains the **Business Logic**, developer workflow, and domain rules in Vietnamese.
  - **No Lazy Dumping**: NEVER append raw, contextless link lists to pass validator checks. Every `.agents/docs/` document MUST provide real value by explaining the business rationale behind the mapped `.agents/knowledge/` facts.
- **Validation & Sidecars**: Register every source that can invalidate a document in `depends_on`. Every `.agents/docs` Markdown file must be a declared sidecar or registered documentation artifact. Every `.agents/knowledge` document MUST have a corresponding human-facing explanation or index link under `.agents/docs/`.
- **Update Criteria**: Update canonical knowledge and docs together whenever intended behavior, contract, architecture, or business procedures change. Update dependent documents only when invalidated. Do not edit documentation for implementation-only bug fixes where intended business behavior is unchanged.
- **Ownership & Metadata**: Give canonical documents a clear owner and status (`draft` | `active` | `deprecated`) when the project team is known.
- **Autonomous Knowledge & Docs Synchronization Gate**:
  - `walkthrough.md` is strictly a task execution transcript for the current session. It does NOT replace persistent knowledge in `.agents/knowledge/` and `.agents/docs/`.
  - Whenever an Agent modifies code in a module (`apps/*/modules/<module>/`, `src/modules/<module>/`, `packages/*/modules/<module>/`) affecting business logic, algorithms, adapters, use-cases, schemas, or APIs, the Agent is autonomously responsible for updating the corresponding `.agents/knowledge/modules/<module>/` (EN) and `.agents/docs/modules/<module>/` (VI) before declaring completion.
  - The Stop Hook and validation system enforce this via automated Documentation Drift checks, blocking task termination if code in a module changed without corresponding documentation updates.

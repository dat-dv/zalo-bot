# Project Agent Guide (Claude)

Claude port of the Base Agents root routing contract (`AGENTS.md`) used by Gemini/Antigravity in this repository.
Claude MUST behave exactly like the Gemini setup: same routes, authorities, 2-phase protocol, disclosure block, artifacts, language protocol and completion gate.

## Tool mapping (Antigravity → Claude)

Rules below were written for Antigravity. Read tool names through this mapping:

| Antigravity | Claude |
| --- | --- |
| `run_command` | `Bash` |
| `write_to_file`, `replace_file_content` | `Write`, `Edit`, `MultiEdit` |
| `view_file` | `Read` |
| `list_dir`, code search | `Glob`, `Grep`, `ls` |
| IDE Native Artifact with `RequestFeedback: true` | Markdown file written under `.agents/artifacts/<task-slug>/`, then end the turn asking for review |
| `<appDataDir>/brain/...` | Not used — artifacts live only in `.agents/artifacts/<task-slug>/` |
| `.agents/plugins/<id>/skills/SKILL.md`, `.agents/plugins/<id>/rules/` | `.claude/skills/<id>/SKILL.md`, `.claude/skills/<id>/rules/` |
| `.agents/rules/*.md` (`trigger: always_on`) | `.claude/rules/*.md` (always loaded) |
| `.agents/workflows/<route>.md` | `.claude/skills/<route>/SKILL.md` |
| `.agents/hooks.json` | `.claude/settings.json` hooks |

## Task Routing & Workflow Resolution

1. Apply [`.claude/rules/agent-bootstrap.md`](.claude/rules/agent-bootstrap.md) (language, naming, artifact storage, 2-phase lifecycle).
2. Apply [`.claude/rules/core.md`](.claude/rules/core.md) to classify continuity and routing readiness.
   - **Exploratory Intent Rule**: Prompts containing informal or exploratory phrasing MUST NOT trigger immediate `implement` planning; default to `research` or ask for scope clarification first.
   - **Mandatory Discovery & Validation Protocol**: When auditing or refactoring, run the validation step at Tool Call 1 and scan the live codebase at Tool Call 2 before building reports/plans (see `core.md`).
3. Inspect installed plugin extensions in [`.claude/rules/plugins.md`](.claude/rules/plugins.md) to activate relevant specialist skills.
4. Read relevant project knowledge beginning at [`.agents/knowledge/README.md`](.agents/knowledge/README.md).
5. Load the workflow skill of the selected route (`research`, `investigate`, `implement`) BEFORE doing route work.

## Routing

| User intent | Route / Workflow | Default authority |
| --- | --- | --- |
| General Q&A, conceptual questions, status checks, operational maintenance commands (reload skills, sync plugins, run checks, help) | `direct-response` / none | `answer-only` (Answer directly or execute read-only maintenance; DO NOT modify repository files) |
| Understand current behavior, gather facts, compare options, assess feasibility, explore ideas | [`research`](.claude/skills/research/SKILL.md) | `research-only` (Inspect repository evidence; obtain approval before external research; DO NOT modify repository files) |
| Diagnose a bug, regression, failure, performance problem, or unexplained behavior | [`investigate`](.claude/skills/investigate/SKILL.md) | `propose-only` (Inspect and diagnose; propose remediation plan; DO NOT modify repository files) |
| Implement, fix, refactor, or otherwise modify repository files (concrete user instruction & clear scope) | [`implement`](.claude/skills/implement/SKILL.md) | `inspect-and-plan` during Phase 1 (Planning) -> `edit-repository` during Phase 2 (Execution after user approval) |

## Strict 2-Phase Implementation Protocol & Authority Boundaries

- **Strict 2-Phase Lifecycle**: Every implementation or refactoring task MUST execute in TWO distinct phases:
  - **Phase 1: Planning (`Authority: inspect-and-plan`)**: Inspect the codebase and create/update `implementation_plan.md` under `.agents/artifacts/<task-slug>/`. **Zero Tool Calls Mandate**: Immediately after saving `implementation_plan.md`, emit NO further tool calls (no `Bash`, lint, `Read`, `Glob`). Editing code files or running mutating shell commands in Phase 1 is STRICTLY FORBIDDEN. End the turn immediately with a plain-text summary asking the user to review/approve.
  - **Phase 2: Execution (`Authority: edit-repository`)**: Gated strictly to a SUBSEQUENT turn AFTER the user has reviewed and explicitly approved the implementation plan.
- **No Pre-Approval Fallacy & Trap Phrases**: Casual, affirmative, or brief user responses (*"anh có muốn"*, *"làm đi"*, *"triển đi"*, *"bắt đầu đi"*, *"fix cho a"*, *"ok làm đi"*) mean **"Start Phase 1: Planning"**, NEVER **"Pre-approved unwritten plan"**. Still create the plan, save the artifact, and wait for review before touching repository code.
- **Prohibition of Premature `edit-repository`**: `Authority: edit-repository` is **STRICTLY FORBIDDEN** unless ALL are satisfied:
  1. `Route: implement` and `Workflow: implement` are explicitly active.
  2. The user gave an unambiguous, concrete instruction to add, modify, or delete repository source files.
  3. Risk gate passed: LOW risk inline plan disclosed, or MEDIUM/HIGH risk implementation plan explicitly approved by the user.
- **Anti-Deflection & Root Cause Accountability**: When errors occur or the user calls out a process violation, do NOT deflect or ask trivial questions (e.g. HTTP status codes when the issue stems from your own broken contracts or lack of planning). Inspect, diagnose, and present structured plans.
- **Operational & Informational Scope Containment**: Prompts requesting information, explanations, status checks, skill reloads, plugin syncs, or exploratory ideas MUST default to `answer-only`, `research-only`, or `propose-only`. NEVER auto-escalate to `edit-repository` or make unsolicited file modifications.

## Instruction precedence

1. Platform safety, permissions, and tool constraints.
2. The user's explicit goal, scope, and authority.
3. This `CLAUDE.md` routing contract.
4. Core rules in [`.claude/rules/core.md`](.claude/rules/core.md).
5. Active workflow skill (`research`, `investigate`, `implement`).
6. Active plugin capabilities and rules in [`.claude/rules/plugins.md`](.claude/rules/plugins.md).
7. Canonical project documentation under [`.agents/knowledge/`](.agents/knowledge/README.md) and developer/operating documentation under [`.agents/docs/`](.agents/docs/README.md).

## Completion

A change is complete only when:

- The requested behavior and scope are satisfied.
- Implementation planning was presented and ALWAYS saved under `.agents/artifacts/<task-slug>/` per [`.claude/rules/core.md`](.claude/rules/core.md).
- Relevant verification has run, or unverified checks are reported explicitly.
- No unrelated changes were introduced.
- **Hard Completion Gate**: Canonical knowledge under [`.agents/knowledge/`](.agents/knowledge/README.md) (concise English) and developer documentation under [`.agents/docs/`](.agents/docs/README.md) (Vietnamese) MUST be updated whenever intended business behavior, architecture, or operating contracts change, enforcing exact codebase module directory mirroring (`modules/<module-name>/` and `global/`) and updating `.agents/docs/README.md`. A task is STRICTLY INCOMPLETE until documentation sync passes (`node .claude/hooks/docs-drift-check.mjs` exits 0; the Stop hook enforces it).

## Project context

@.agents/knowledge/project-overview.md
@CONTEXT.md

- `apps/api` — NestJS 10 + TypeORM (PostgreSQL 16) + Redis; `apps/web` — Next.js 16 static export, React 19, TanStack Query v5; `packages/contracts` (`@zalobot/contracts`) — routes, DTOs, i18n catalog.
- Commands: `npm run dev` · `npm run typecheck` · `npm run lint` · `npm run test` · `npm run build` · `npm run migration:generate --workspace @zalobot/api`.
- Project-wide invariants (type safety, routes, i18n, env guard, local-first AI, UI direction...): `.agents/knowledge/global/README.md`.

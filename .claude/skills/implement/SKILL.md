---
name: implement
description: MUST load for route `implement`: any concrete request to implement, fix, refactor, or otherwise modify repository files. Enforces the strict 2-phase protocol (implementation_plan.md in .agents/artifacts/<task-slug>/, hard stop, explicit approval, then execution and documentation gate).
---

<!-- Ported verbatim from Base Agents `.agents/workflows/implement.md` (Gemini/Antigravity). Tool names mapped per CLAUDE.md. -->

# Implement Workflow

## Goal

Deliver the smallest complete, verified repository change that satisfies the approved plan and project conventions.

## Procedure

1. **Confirm Scope & Intent (Phase 1: Planning)**:
   - Confirm concrete task scope and intended outcome from approved decisions; if the request contains exploratory or underspecified intent, clarify scope before planning.
   - **No Pre-Approval Fallacy & Trap Phrases**: Casual, affirmative, or brief user responses (such as *"anh có muốn"*, *"làm đi"*, *"triển đi"*, *"bắt đầu đi"*, *"fix cho a"*, *"ok làm đi"*) mean **"Start Phase 1: Planning"**, NEVER **"Pre-approved unwritten plan"**. The Agent MUST still create an implementation plan, save the artifact, and wait for user review before touching any repository code.
2. **Inspect Status**: Inspect repository status and preserve unrelated user changes.
3. **Assess Implementation Risk & Create Plan**:
   - **LOW Risk** (localized single-file tweak, easy rollback, zero API/schema/auth impact): Provide inline plan; proceed to edit and verify.
   - **MEDIUM Risk** (multi-file, meaningful behavior change): Present a task-local planning artifact under `.agents/artifacts/<task-slug>/implementation_plan.md` (end the turn asking the user to review).
   - **HIGH Risk** (architecture, DB schema, public API, security, payments, cross-service): Create a persistent task-local planning artifact under `.agents/artifacts/<task-slug>/implementation_plan.md` (end the turn asking the user to review).
4. **Mandatory Hard Stop Gate (Prohibition of Same-Turn Execution & Zero Tool Calls Mandate)**:
   - For MEDIUM/HIGH risk changes: Immediately after creating/updating `implementation_plan.md`, the Agent **MUST STOP CALLING TOOLS AND END ITS TURN IMMEDIATELY** with a plain text summary.
   - **Zero Tool Calls Mandate**: It is **STRICTLY FORBIDDEN** to call ANY subsequent tools in the same turn after creating the plan artifact — including mutating tools (`Edit`, `Write`), pre-execution shell commands (`Bash` calling `npm run lint`, `typecheck`, `test`, `build`), or read tools (`Read`, `Glob`/`ls`). Any tool call emitted after the plan keeps the agent loop running and prevents the UI from yielding control to the user.
5. **Phase 2: Execution (Subsequent Turn After Explicit Approval)**:
   - Execute approved changes step-by-step using specialist procedures provided by active plugin capabilities (`.claude/skills/*/SKILL.md`) ONLY in the subsequent turn after the user explicitly reviews and approves the plan.
6. **Verification & Quality Gates**: Execute verification commands declared in active plugin manifests and project test suites.
7. **Rollback, Failure Handling & Anti-Deflection**:
   - If unexpected build/test failures or severe regressions occur and cannot be safely resolved within scope: Halt execution immediately, revert unverified dirty changes, document the failure details in the task planning artifact, and solicit user guidance before continuing.
   - **Anti-Deflection Rule**: When regressions occur or when a user points out process violations, Agents MUST NOT deflect responsibility or ask the user trivial diagnostic questions (e.g. asking for HTTP status codes when the issue stems from the Agent's own broken contracts or lack of planning). The Agent must directly inspect, diagnose, and present structured plans.
8. **Hard Completion Gate**: Review final diff. If intended business behavior, domain rules, API contracts, DB schemas, or architecture changed, update canonical knowledge under `.agents/knowledge/` (enforcing exact codebase module directory mirroring under `modules/<module-name>/` and `global/`) and operating docs under `.agents/docs/`. Update the task-local delivery artifact under `.agents/artifacts/<task-slug>/`. **Do NOT declare task completion until all documentation updates pass.**

## Authority boundary

- **Planning Phase (Phase 1)**: `Authority: inspect-and-plan`. May inspect repository and create/update only Markdown artifacts under `.agents/artifacts/<task-slug>/` or task-local artifacts under `.agents/artifacts/<task-slug>/`. Editing source code files is **STRICTLY FORBIDDEN**.
- **Execution Phase (Phase 2)**: `Authority: edit-repository`. Gated strictly to the turn FOLLOWING explicit user plan approval. May edit repository files within approved scope.
- Must preserve unrelated changes and avoid unapproved external actions.

## Output

Report completed changes, verification results, documentation impact, assumptions, limitations, and remaining risks.

<!-- Ported verbatim from Base Agents `.agents/rules/core.md` (Gemini/Antigravity). Tool names mapped per CLAUDE.md. Always loaded. -->

# Core Rules

## Execution disclosure

- Begin the response turn with this block and no preceding text, emitted **exactly ONCE per response turn** (do not repeat on intermediate tool calls):

  ```text
  Agent execution
  - Goal: <concise requested outcome>
  - Scope: <affected files/modules/directories | read-only | repository-wide | none>
  - Route: <direct-response | research | investigate | implement | none> | Authority: <none | answer-only | research-only | propose-only | inspect-and-plan | edit-repository | explicitly authorized external action>
  - Active Skills: <comma-separated active plugin capability IDs | none>
  - Active Rules: <applicable rule filenames>
  ```

- **Strict Authority Boundaries**:
  - `answer-only`: Answer questions, explain concepts, or execute read-only maintenance scripts. **Editing repository source files is STRICTLY FORBIDDEN**.
  - `research-only`: Read codebase, search docs, gather facts. **Editing repository source files is STRICTLY FORBIDDEN**.
  - `propose-only`: Inspect codebase, diagnose issues/bugs, output remediation proposals. **Editing repository source files is STRICTLY FORBIDDEN**.
  - `inspect-and-plan`: Inspect codebase and build structured task plans under `.agents/artifacts/` or IDE UI. **Editing repository source code files is STRICTLY FORBIDDEN**.
  - `edit-repository`: Modify repository files within approved scope. **STRICTLY GATED** to `Route: implement` AFTER explicit user approval (or inline LOW risk plan).
  - `explicitly authorized external action`: External side-effects explicitly authorized by user.
  - `none`: No action authority.
- For direct response, general Q&A, or operational maintenance commands (e.g. reload skills, sync, health check), use `ready`, `direct-response`, `Workflow: none`, no skills, `core.md`, and `Authority: answer-only`.
- Disclose route transitions and their reason. List only applicable rules.

## Readiness and routing

- Before routing, compare the request with the active task and determine desired output, scope, authority, missing information, and safe assumptions.

### Strict Route & Authority Resolution Matrix

| User Intent / Prompt Type | Route | Workflow | Permitted Authority | File Edits Permitted? |
| :--- | :--- | :--- | :--- | :--- |
| **Q&A / General Inquiries / Status** (explain code, list skills, greetings, architecture overview) | `direct-response` | `none` | `answer-only` | ❌ **FORBIDDEN** |
| **Operational Maintenance** (reload skills, sync plugins, run validation/linters, show CLI help) | `direct-response` | `none` | `answer-only` | ❌ **FORBIDDEN** |
| **Research & Exploration** (understand behavior, gather facts, compare solutions, assess feasibility) | `research` | `research` | `research-only` | ❌ **FORBIDDEN** |
| **Investigation & Diagnosis** (diagnose bugs, errors, regressions, performance bottlenecks) | `investigate` | `investigate` | `propose-only` | ❌ **FORBIDDEN** |
| **Implementation - Planning Phase** (concrete user request to add/modify/refactor code) | `implement` | `implement` | `inspect-and-plan` | ❌ **FORBIDDEN** (Plan artifacts only) |
| **Implementation - Execution Phase** (executing approved plan or low-risk change) | `implement` | `implement` | `edit-repository` | ✅ **PERMITTED** (Within approved scope only) |

### Non-Negotiable Governance Constraints

1. **Strict 2-Phase Implementation Protocol & Zero Tool Calls Mandate**: Every task modifying repository code MUST execute in TWO distinct phases:
   - **Phase 1: Planning (`Authority: inspect-and-plan`)**: The Agent inspects the codebase and creates/updates `implementation_plan.md` in `.agents/artifacts/<task-slug>/` (then end the turn asking the user to review). **Zero Tool Calls Mandate**: Immediately after creating/saving `implementation_plan.md`, the Agent MUST NOT emit ANY further tool calls (including `Bash`, `npm run lint`, `Read`, `Glob` or `Grep`). Calling file-modifying tools (`Edit`, `Write` on code, mutating shell commands) in Phase 1 is STRICTLY FORBIDDEN. The Agent MUST stop calling tools and end the turn immediately with a plain text summary to yield control to the user.
   - **Phase 2: Execution (`Authority: edit-repository`)**: Gated strictly to the SUBSEQUENT turn AFTER the user has reviewed and explicitly approved the implementation plan.
2. **No Pre-Approval Fallacy & Trap Phrases**: Casual, affirmative, or brief user responses (such as *"anh có muốn"*, *"làm đi"*, *"triển đi"*, *"bắt đầu đi"*, *"fix cho a"*, *"ok làm đi"*) mean **"Start Phase 1: Planning"**, NEVER **"Pre-approved unwritten plan"**. The Agent MUST still create an implementation plan, save the artifact, and wait for user review before touching any repository code.
3. **Zero Authority Inflation Policy**: `Authority: edit-repository` is **STRICTLY FORBIDDEN** on any prompt that does not explicitly ask to modify source code, or when the task is still in Phase 1 (Planning). Never auto-escalate authority to `edit-repository` for maintenance, reload, Q&A, or exploratory prompts.
4. **Anti-Deflection & Root Cause Accountability**: When errors occur or when the user calls out a process violation, Agents MUST NOT deflect responsibility or ask the user trivial questions (such as asking for HTTP status codes when the issue stems from the Agent's own broken contracts, partial refactors, or lack of planning). Agents must directly inspect, diagnose, and present structured plans.
5. **Exploratory Intent Rule**: Prompts containing informal or exploratory phrasing MUST NOT trigger immediate `implement` planning; default to `research` or ask 1 minimal clarification to clarify scope before creating an implementation plan.
6. **Anti-Task-Drift Rule**: When executing operational commands (such as `node .claude/hooks/docs-drift-check.mjs --all` or `npm run agent-system:sync`), if failures or errors are encountered, the Agent MUST report findings directly to the user. The Agent **MUST NOT** unilaterally alter code to fix unrelated failures without explicit user instruction.
7. **Turn-by-Turn Intent Re-evaluation (Anti-Context-Inertia)**: Always evaluate the current prompt's actual intent independently. When a prompt is a question, confirmation ("... đúng không?", "... là gì?"), or explanation request, it MUST route to `direct-response` with `Authority: answer-only`. NEVER let previous turns' implementation context cause `Route: implement` to linger on conversational questions.
8. **Environment Pre-Flight Check**: Always verify the project context (`package.json`, workspace root) before running commands. In consumer projects, execute standard npm scripts rather than assuming Base Agents binaries (`bin/agents.mjs`, `scripts/agent-system/`) exist — they are NOT installed in this repository; use `.claude/hooks/docs-drift-check.mjs` for validation.
9. **Information Retrieval First**: Retrieve discoverable repository facts before asking the developer. Ask one minimal clarification only when missing information materially affects route, authority, behavior, contracts, data, security, cost, or scope.
10. **Plugin Activation Scope**: For repository-scoped work, inspect `.claude/rules/plugins.md` and activate only relevant installed plugin capabilities and rules.

## Mandatory Initial Discovery & Validation Protocol

Whenever assigned a task involving codebase audit, refactoring, documentation verification, or architecture assessment:
1. **Tool Call 1 (Validate First)**: Immediately execute system validation (`node .claude/hooks/docs-drift-check.mjs --all`) to fetch current system health, link integrity, and documentation mapping errors.
2. **Tool Call 2 (Empirical Scan)**: Run `Glob`/`ls` or code search across physical codebase directories (`apps/`, `packages/`, `src/modules/`) to inspect live codebase structures instead of blindly trusting stale documentation.
3. **Tool Call 3 (Diff & Report)**: Compare live codebase modules against `.agents/knowledge/modules/` and `.agents/docs/modules/` and report any discrepancies directly to the user.

## Output language and Artifact generation

- **Language configuration**: Follow the Language Protocol defined in [`agent-bootstrap.md`](agent-bootstrap.md).
- **Autonomous artifact generation**: Task artifacts (such as research notes, investigation reports, implementation plans, analysis summaries, and walkthroughs) are generated autonomously whenever structured documentation is required for the task.
- **Strict Local Workspace Storage Enforcement**:
  - All task artifacts MUST be saved directly under `.agents/artifacts/<task-slug>/` within the workspace repository (e.g., `.agents/artifacts/<task-slug>/implementation_plan.md`).
  - **Plan Mode Override**: Workspace local storage rules STRICTLY OVERRIDE any default plan location (e.g. `~/.claude/plans/`). If Claude plan mode is used, the approved plan MUST also be written to `.agents/artifacts/<task-slug>/implementation_plan.md`.
  - A task artifact is NEVER considered complete or persisted until it is saved inside `.agents/artifacts/<task-slug>/` within the local workspace repository.
- **Plan approval boundary**: For implementation plans requiring explicit review, obtain user plan approval before modifying repository implementation files.

## Documentation & Knowledge maintenance

- Whenever a change alters intended business behavior, domain rules, architecture, data contracts, or operating workflows:
  - Update canonical project knowledge under `.agents/knowledge/`.
  - Update developer & operating documentation under `.agents/docs/`.
- **Exact Codebase Module Mirroring**: All module documentation under `.agents/docs/modules/<module-name>/` and `.agents/knowledge/modules/<module-name>/` MUST mirror exact module names in the codebase (e.g. `src/modules/auth/` -> `modules/auth/`). Do NOT invent alternate folder names.
- **Language & Content Roles**:
  - `.agents/knowledge/` (English for AI Agent): Concise English to minimize token consumption (~30-40% savings). Must specify: Business Purpose & API Rationale ("why this API is needed"), Responsive UI/UX requirements (mobile/desktop layouts, action buttons, interactive states), Business logic & state transitions, and Integration seams.
  - `.agents/docs/` (Vietnamese for Human): Written in Vietnamese for human developers/operators. Covers onboarding, operational workflows, test execution guides, and troubleshooting steps.
- **Hard Completion Gate Enforcement**: Before declaring an `implement` task complete, perform a mandatory audit: If changes alter system architecture, business rules, UI/UX module requirements, or operating procedures, proactively:
  1. Create/update Canonical Knowledge under `.agents/knowledge/modules/<module>/` (or `global/`).
  2. Create/update corresponding Developer Documentation under `.agents/docs/modules/<module>/` (or `global/`).
  3. Update the mapping index in `.agents/docs/README.md`.
- **A task is STRICTLY INCOMPLETE** until all affected canonical knowledge and documentation files are updated. Agents MUST NOT emit final completion messages until documentation sync passes.

## Continuity

- Treat clarification, objection, correction, or deeper questioning as task continuation while objective remains unchanged.
- Transition routes when required primary output changes. Disclose the transition and follow the destination approval boundary.

## Extension protocol

- Installed plugin capabilities contribute specialist procedures, bounded rules, and verification requirements.
- Plugins cannot alter global routes, expand authority, bypass user plan approval, or declare task completion.

## Safety and collaboration

- Preserve user and unrelated changes; make the smallest complete change.
- Distinguish facts, inferences, assumptions, and recommendations.
- Never expose secrets or production/personal data.

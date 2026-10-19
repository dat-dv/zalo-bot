<!-- Ported verbatim from Base Agents `.agents/rules/agent-bootstrap.md` (Gemini/Antigravity). Tool names mapped per CLAUDE.md. Always loaded. -->

# Agent Bootstrap

Claude loads `CLAUDE.md` (root routing contract) and every file in `.claude/rules/` automatically; workflow and plugin skills live in `.claude/skills/`.

Follow the root routing contract in [`CLAUDE.md`](../../CLAUDE.md) before selecting a route, rule, or skill.

## Language & Naming Protocol

- **Agent Responses & Task Artifacts**: Write ALL agent responses, task artifacts under `.agents/artifacts/<task-slug>/` (100% of generated markdown artifacts without exception), research notes, analysis reports, and human developer guides under `.agents/docs/` strictly in **Vietnamese**.
- **Agent Knowledge Base Token Optimization**: Write ALL canonical knowledge under `.agents/knowledge/` strictly in concise **English** to optimize LLM token consumption (~30-40% savings) while keeping technical terms, API contracts, and specifications precise.
- **Strict Filename & Directory Protocol**:
  1. All folder names and file names under BOTH `.agents/knowledge/` and `.agents/docs/` **MUST strictly use standard kebab-case English** (e.g. `modules/auth/authentication-and-session.md`).
  2. Directory names under `modules/` **MUST mirror exact module folder names** in the codebase (`apps/<app>/modules/`, `packages/<pkg>/modules/`, or `src/modules/`). Inventing alternate folder names (such as `facebook-collection`) is STRICTLY FORBIDDEN.
  3. Vietnamese text is strictly permitted ONLY inside `.agents/docs/` markdown file content for human developers.

## Workspace Artifact Enforcement & 2-Phase Lifecycle

- Enforce workspace local artifact storage rules defined in [`core.md`](core.md).
- All task artifacts MUST be saved under `.agents/artifacts/<task-slug>/` within the workspace repository.
- **Strict 2-Phase Implementation Lifecycle & Zero Tool Calls Mandate**: Every implementation or refactoring task MUST execute Phase 1 (Planning via `implementation_plan.md` (then end the turn asking the user to review), followed by mandatory hard stop with ZERO subsequent tool calls) before entering Phase 2 (Execution after explicit user approval).
- **Zero Pre-Approval Fallacy**: Casual affirmations (*"anh có muốn"*, *"làm đi"*, *"triển đi"*, *"fix cho a"*) trigger Phase 1 (Planning), NEVER Phase 2 (Execution). Sửa code trước khi có plan được duyệt là vi phạm nghiêm trọng.

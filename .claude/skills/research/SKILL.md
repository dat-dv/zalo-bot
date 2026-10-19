---
name: research
description: MUST load for route `research` (authority research-only): understand current behavior, gather facts, compare options, assess feasibility, explore ideas — e.g. tìm hiểu, so sánh, có nên, giải thích. No repository edits.
---

<!-- Ported verbatim from Base Agents `.agents/workflows/research.md` (Gemini/Antigravity). Tool names mapped per CLAUDE.md. -->

# Research Workflow

## Goal

Deliver traceable findings and a bounded next-step proposal without inventing approved product requirements or modifying the repository.

## Procedure

1. Identify the question, decision, expected output, and evidence needed.
2. Formulate research findings and recommendations using Markdown artifacts under `.agents/artifacts/<task-slug>/` or structured Markdown notes.
3. Inspect relevant repository documents, code, and installed capabilities (`.claude/rules/plugins.md`) first when project context matters or can narrow external work.
4. If material external research is needed (e.g. web search, external documentation lookup), request explicit user authorization first.
5. Separate repository evidence, external facts, inference, uncertainty, and recommendation.
6. Compare options using project-specific criteria, present findings and observed sources, and end the response with a proposed next-step plan.

## Authority boundary

- May inspect repository evidence, resolve relevant installed capabilities, perform authorized external research, and present findings.
- Must not establish approved business rules, modify repository files, or treat its next-step proposal as implementation approval.

## Output

Lead with findings, cite sources where applicable, state project implications and uncertainty, then provide a concise proposed next-step plan.

## Handoff

- Transition to `investigate` when the primary outcome becomes root-cause diagnosis.
- Transition to `implement` when the user requests repository changes; preserve task context.

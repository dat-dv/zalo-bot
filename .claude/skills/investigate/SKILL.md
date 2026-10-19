---
name: investigate
description: MUST load for route `investigate` (authority propose-only): diagnose a bug, regression, failure, error, performance problem or unexplained behavior — e.g. lỗi, bị 500, không chạy, chậm, tại sao. No repository edits.
---

<!-- Ported verbatim from Base Agents `.agents/workflows/investigate.md` (Gemini/Antigravity). Tool names mapped per CLAUDE.md. -->

# Investigate Workflow

## Goal

Establish the root cause and affected scope with evidence, then propose a remediation plan without modifying repository files.

## Procedure

1. Capture observed behavior, expected behavior, environment, and reproduction conditions in a Markdown artifact or a task-local diagnosis artifact under `.agents/artifacts/<task-slug>/`.
2. Inspect relevant code, tests, configuration, logs, active capabilities (`.claude/rules/plugins.md`), and runtime state using safe read-only diagnostics.
3. Reproduce the failure when practical and safe.
4. Test competing hypotheses; distinguish trigger, contributing conditions, and root cause.
5. Determine affected paths, dependencies, compatibility concerns, and regression risks.
6. Present evidence, root cause or remaining uncertainty, affected scope, and verification, then propose the smallest safe remediation and regression-test strategy.

## Authority boundary

- May inspect the repository, run safe non-mutating diagnostics, and present diagnostic findings using Markdown artifacts under `.agents/artifacts/<task-slug>/`.
- Must not modify repository files or claim a root cause without sufficient evidence.

## Output

Lead with the diagnosis, evidence, affected scope, confidence, and a proposed remediation plan. State explicitly when the root cause remains unconfirmed.

## Handoff

Transition to `implement` when the user requests the fix. Create a task-local planning artifact under `.agents/artifacts/<task-slug>/` and obtain explicit user approval before editing any repository files.

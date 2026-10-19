#!/usr/bin/env node
// Claude Code PreToolUse hook (Edit | Write | MultiEdit): blocks Zero-Any violations.
// Ported from Base Agents scripts/agent-system/hooks/type-safety-guard.mjs.
import { readFileSync } from "node:fs";
import { checkTypeSafety, isTypeScriptFile } from "./type-safety-rules.mjs";

function readPayload() {
  try {
    const raw = readFileSync(0, "utf8");
    return raw.trim() ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function collectNewCode(toolName, input) {
  if (toolName === "Write") return typeof input.content === "string" ? input.content : "";
  if (toolName === "Edit") return typeof input.new_string === "string" ? input.new_string : "";
  if (toolName === "MultiEdit" && Array.isArray(input.edits)) {
    return input.edits.map((e) => (e && typeof e.new_string === "string" ? e.new_string : "")).join("\n");
  }
  return "";
}

const payload = readPayload();
if (!payload) process.exit(0);

const toolName = payload.tool_name ?? "";
const input = payload.tool_input ?? {};
const filePath = typeof input.file_path === "string" ? input.file_path : "";
const code = collectNewCode(toolName, input);

if (!isTypeScriptFile(filePath) || !code) process.exit(0);

const violations = checkTypeSafety(code, filePath);
if (violations.length === 0) process.exit(0);

const details = violations
  .map((v) => `  - Dòng ${v.line} (trong đoạn mới): [${v.rule}] ${v.message}\n    Code: \`${v.code}\``)
  .join("\n");

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason:
        `[Type Safety Guard - VI PHẠM ZERO-ANY RULE] ${violations.length} vi phạm trong '${filePath}':\n${details}\n\n` +
        "Sửa bằng kiểu tường minh, 'unknown' + type guard, hoặc Generics <T>. Xem .claude/rules/type-safety.md.",
    },
  }),
);
process.exit(0);

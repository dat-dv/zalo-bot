#!/usr/bin/env node
// Claude Code PreToolUse hook (Bash): denies destructive commands (same as Base Agents safety-guard).
// Ported from Base Agents scripts/agent-system/hooks/safety-guard.mjs.
import { readFileSync } from "node:fs";

let payload = null;
try {
  const raw = readFileSync(0, "utf8");
  payload = raw.trim() ? JSON.parse(raw) : null;
} catch {
  payload = null;
}
if (!payload || payload.tool_name !== "Bash") process.exit(0);

const command = typeof payload.tool_input?.command === "string" ? payload.tool_input.command : "";
const cmd = command.toLowerCase();
const dangerous = [
  /\brm\s+-[a-z]*r[a-z]*f[a-z]*\s+[/~]/,
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+clean\s+-[a-z]*f/,
  /\bgit\s+push\b.*(--force\b|\s-f\b)/,
  /\bdrop\s+(database|table|schema)\b/,
  /\btruncate\s+table\b/,
  /\bdocker\s+(compose\s+)?.*down\s+.*-v\b/,
  /\bdocker\s+volume\s+(rm|prune)\b/,
  /\bmigration:revert\b/,
];

const hit = dangerous.find((p) => p.test(cmd));
if (!hit) process.exit(0);

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `[Safety Guard] Lệnh có thể gây mất dữ liệu: '${command}'. Bị chặn vì có khả năng gây mất mát dữ liệu hoặc phá hoại hệ thống. Nếu thật sự cần, anh tự chạy lệnh này.`,
    },
  }),
);
process.exit(0);

#!/usr/bin/env node
// Claude Code PostToolUse hook (Edit | Write | MultiEdit): runs Prettier on the edited file.
// Ported from Base Agents scripts/agent-system/hooks/format-edited-file.mjs.
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

let payload = null;
try {
  const raw = readFileSync(0, "utf8");
  payload = raw.trim() ? JSON.parse(raw) : null;
} catch {
  payload = null;
}
const filePath = typeof payload?.tool_input?.file_path === "string" ? payload.tool_input.file_path : "";
if (filePath && existsSync(filePath) && /\.(ts|tsx|js|mjs|json)$/.test(filePath) && !filePath.includes("/node_modules/")) {
  try {
    execFileSync("npx", ["--no-install", "prettier", "--write", filePath], {
      stdio: "pipe",
      cwd: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
      timeout: 15000,
    });
  } catch {
    // Prettier unavailable or file not formattable: ignore, never block.
  }
}
process.exit(0);

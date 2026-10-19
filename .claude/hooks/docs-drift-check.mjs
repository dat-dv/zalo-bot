#!/usr/bin/env node
// Documentation drift gate — Claude port of Base Agents `docs-smart-gate` Stop hook
// (validators/documentation-coverage.ts: validateCodeToDocSync + validateCodebaseModuleMirroring).
//
// Usage:
//   node .claude/hooks/docs-drift-check.mjs          # changed-files drift check (exit 1 on errors)
//   node .claude/hooks/docs-drift-check.mjs --all    # + module mirroring & naming audit
//   (as Stop hook, stdin JSON present)              # blocks Claude from stopping while drift exists
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const args = process.argv.slice(2);
const auditAll = args.includes("--all");

let hookPayload = null;
if (!process.stdin.isTTY && !auditAll) {
  try {
    const raw = readFileSync(0, "utf8");
    hookPayload = raw.trim() ? JSON.parse(raw) : null;
  } catch {
    hookPayload = null;
  }
}

const MODULE_RE = /^(?:(?:apps|packages)\/[^/]+\/)?(?:src\/)?modules\/([^/]+)\//;
const CODE_RE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i;
const TEST_RE = /\.(test|spec)\.(ts|tsx|js)$|\.d\.ts$/i;

function changedFiles() {
  let out = "";
  try {
    out = execSync("git status --porcelain --untracked-files=all", { cwd: root, encoding: "utf8" });
  } catch {
    return [];
  }
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const p = line.slice(3).trim();
      const arrow = p.indexOf(" -> ");
      return (arrow >= 0 ? p.slice(arrow + 4) : p).replace(/^"|"$/g, "");
    });
}

function listDirs(path) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name);
}

const errors = [];

// 1. Code-to-doc sync (Documentation Drift)
const files = changedFiles();
const modified = new Map();
for (const f of files) {
  if (f.startsWith(".agents/") || f.includes("node_modules/") || !CODE_RE.test(f) || TEST_RE.test(f)) continue;
  const m = f.match(MODULE_RE);
  if (!m) continue;
  const list = modified.get(m[1]) ?? [];
  list.push(f);
  modified.set(m[1], list);
}
for (const [mod, list] of modified) {
  const hasKnowledge = files.some((f) => f.startsWith(`.agents/knowledge/modules/${mod}/`));
  const hasDocs = files.some((f) => f.startsWith(`.agents/docs/modules/${mod}/`));
  if (!hasKnowledge && !hasDocs) {
    const sample = list.slice(0, 2).join(", ");
    const more = list.length > 2 ? ` (và ${list.length - 2} file khác)` : "";
    errors.push(
      `Documentation Drift: Code in module '${mod}' was modified [${sample}${more}], but '.agents/knowledge/modules/${mod}/' (EN) or '.agents/docs/modules/${mod}/' (VI) was not updated.`,
    );
  }
}

// 2. Full audit: module mirroring + naming
if (auditAll) {
  const codeModules = new Set();
  for (const base of ["apps", "packages"]) {
    for (const app of listDirs(join(root, base))) {
      for (const sub of ["src/modules", "modules"]) listDirs(join(root, base, app, sub)).forEach((m) => codeModules.add(m));
    }
  }
  listDirs(join(root, "src/modules")).forEach((m) => codeModules.add(m));
  const knowledge = new Set(listDirs(join(root, ".agents/knowledge/modules")));
  const docs = new Set(listDirs(join(root, ".agents/docs/modules")));
  for (const m of knowledge) if (!codeModules.has(m)) errors.push(`Module Coverage: Documented module '${m}' under .agents/knowledge/modules/ does not exist in codebase.`);
  for (const m of codeModules) if (!knowledge.has(m)) errors.push(`Module Coverage: Codebase module '${m}' is missing documentation in .agents/knowledge/modules/.`);
  for (const m of knowledge) if (!docs.has(m)) errors.push(`Docs Mapping: '.agents/knowledge/modules/${m}/' has no matching '.agents/docs/modules/${m}/'.`);
  for (const m of docs) if (!knowledge.has(m)) errors.push(`Docs Mapping: '.agents/docs/modules/${m}/' has no matching '.agents/knowledge/modules/${m}/'.`);
  let tracked = [];
  try {
    tracked = execSync("git ls-files --cached --others --exclude-standard .agents/knowledge .agents/docs", { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {
    tracked = [];
  }
  for (const f of tracked) if (!/^\.agents\/(knowledge|docs)\/[a-z0-9./-]+$/.test(f.replace(/README\.md$/, "readme.md"))) errors.push(`${f}: names under .agents/knowledge/ and .agents/docs/ must be kebab-case English.`);
}

// Output
if (hookPayload) {
  if (errors.length === 0 || hookPayload.stop_hook_active) process.exit(0);
  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason:
        `[Docs Smart Gate - Hard Completion Gate]\n${errors.join("\n")}\n\n` +
        "Cập nhật canonical knowledge (EN) và developer docs (VI) cho các module trên (xem .claude/rules/repository-changes.md) trước khi kết thúc task. " +
        "Nếu thay đổi chỉ là bug fix không đổi business behavior, nêu rõ lý do trong câu trả lời.",
    }),
  );
  process.exit(0);
}

if (errors.length === 0) {
  console.log("docs-drift-check: PASS (0 errors)");
  process.exit(0);
}
console.log(`docs-drift-check: ${errors.length} error(s)\n- ${errors.join("\n- ")}`);
process.exit(1);

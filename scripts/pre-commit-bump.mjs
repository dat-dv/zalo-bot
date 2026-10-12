#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PACKAGE_PATHS = [
  'package.json',
  'apps/api/package.json',
  'apps/web/package.json',
  'packages/contracts/package.json',
];

function runCommand(cmd) {
  try {
    return execSync(cmd, { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function shouldSkipBump() {
  if (process.env.SKIP_BUMP === '1' || process.env.SKIP_BUMP === 'true') {
    return true;
  }

  // Skip during merge or rebase
  const gitDir = path.join(rootDir, '.git');
  if (
    fs.existsSync(path.join(gitDir, 'MERGE_HEAD')) ||
    fs.existsSync(path.join(gitDir, 'rebase-merge')) ||
    fs.existsSync(path.join(gitDir, 'rebase-apply'))
  ) {
    return true;
  }

  // If author already staged a version change in package.json, skip auto bump
  const cachedDiff = runCommand('git diff --cached -U0 package.json');
  if (cachedDiff && /^\+\s*"version":/m.test(cachedDiff)) {
    return true;
  }

  return false;
}

function bumpPatch(version) {
  const clean = (version || '1.0.0').replace(/^v/, '');
  const parts = clean.split('.').map((p) => parseInt(p, 10) || 0);
  while (parts.length < 3) parts.push(0);
  parts[2] += 1;
  return parts.join('.');
}

function main() {
  if (shouldSkipBump()) {
    return;
  }

  const rootPkgPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(rootPkgPath)) return;

  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
  const currentVersion = rootPkg.version || '1.0.0';
  const newVersion = bumpPatch(currentVersion);

  for (const relPath of PACKAGE_PATHS) {
    const fullPath = path.join(rootDir, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const pkg = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    pkg.version = newVersion;
    fs.writeFileSync(fullPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  }

  const existingFiles = PACKAGE_PATHS.filter((p) => fs.existsSync(path.join(rootDir, p))).join(' ');
  runCommand(`git add ${existingFiles}`);

  console.log(`🚀 [Auto-Release] Tự động nhảy version: v${currentVersion} ➔ v${newVersion}`);
}

main();

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function runCommand(cmd) {
  try {
    return execSync(cmd, { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function main() {
  if (process.env.SKIP_BUMP === '1' || process.env.SKIP_TAG === '1') {
    return;
  }

  const rootPkgPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(rootPkgPath)) return;

  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
  const version = rootPkg.version;
  if (!version) return;

  const tagName = `v${version}`;
  const tagExists = runCommand(`git rev-parse -q --verify "refs/tags/${tagName}"`);

  if (!tagExists) {
    runCommand(`git tag -a "${tagName}" -m "Release ${tagName}"`);
    console.log(`🏷️  [Auto-Release] Đã tự động tạo git tag: ${tagName}`);
  }
}

main();

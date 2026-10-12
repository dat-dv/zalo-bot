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

function getCommitsSinceLastTag(pendingMessage) {
  const lastTag = runCommand('git describe --tags --abbrev=0');
  const gitLogCommand = lastTag
    ? `git log ${lastTag}..HEAD --pretty=format:"%h%x09%s"`
    : `git log -n 50 --pretty=format:"%h%x09%s"`;

  const output = runCommand(gitLogCommand);
  const commits = [];

  if (pendingMessage && pendingMessage.trim()) {
    const firstLine = pendingMessage.trim().split('\n')[0].trim();
    if (firstLine && !firstLine.startsWith('#')) {
      commits.push({ hash: 'staged', subject: firstLine });
    }
  }

  if (output) {
    const list = output
      .split('\n')
      .map((line) => {
        const [hash, ...rest] = line.split('\t');
        return { hash: hash?.trim(), subject: rest.join('\t')?.trim() };
      })
      .filter((item) => item.hash && item.subject);
    commits.push(...list);
  }

  // Deduplicate by subject
  const seen = new Set();
  return commits.filter((c) => {
    const key = c.subject.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function categorizeCommits(commits) {
  const categories = {
    feat: [],
    fix: [],
    perf: [],
    refactor: [],
    chore: [],
    other: [],
  };

  for (const commit of commits) {
    const s = commit.subject;
    // Skip release commits & merges
    if (/^chore\(release\):/i.test(s) || /^release:/i.test(s) || /^Merge /i.test(s)) continue;

    if (/^feat(\(.*?\))?:/i.test(s)) {
      categories.feat.push(commit);
    } else if (/^fix(\(.*?\))?:/i.test(s)) {
      categories.fix.push(commit);
    } else if (/^perf(\(.*?\))?:/i.test(s)) {
      categories.perf.push(commit);
    } else if (/^refactor(\(.*?\))?:/i.test(s)) {
      categories.refactor.push(commit);
    } else if (/^(chore|docs|test|ci|build|style)(\(.*?\))?:/i.test(s)) {
      categories.chore.push(commit);
    } else {
      categories.other.push(commit);
    }
  }

  return categories;
}

function generateMarkdownSection(version, categories) {
  const dateStr = new Date().toISOString().split('T')[0];
  let section = `## [v${version}] - ${dateStr}\n\n`;
  let hasEntries = false;

  const formatItem = (c) => (c.hash === 'staged' ? `- ${c.subject}\n` : `- ${c.subject} (${c.hash})\n`);

  if (categories.feat.length > 0) {
    hasEntries = true;
    section += `### 🚀 Tính năng mới (Features)\n`;
    for (const c of categories.feat) {
      section += formatItem(c);
    }
    section += `\n`;
  }

  if (categories.fix.length > 0) {
    hasEntries = true;
    section += `### 🐛 Sửa lỗi (Bug Fixes)\n`;
    for (const c of categories.fix) {
      section += formatItem(c);
    }
    section += `\n`;
  }

  if (categories.perf.length > 0 || categories.refactor.length > 0) {
    hasEntries = true;
    section += `### ⚡ Cải tiến & Tối ưu (Improvements)\n`;
    for (const c of [...categories.perf, ...categories.refactor]) {
      section += formatItem(c);
    }
    section += `\n`;
  }

  if (categories.chore.length > 0 || categories.other.length > 0) {
    hasEntries = true;
    section += `### 🔧 Bảo trì & Khác (Maintenance)\n`;
    for (const c of [...categories.chore, ...categories.other]) {
      section += formatItem(c);
    }
    section += `\n`;
  }

  if (!hasEntries) {
    section += `- Cập nhật và nâng cấp hệ thống trợ lý Zalo Bot.\n\n`;
  }

  return section;
}

function updateChangelog(version, changelogSection) {
  const changelogPath = path.join(rootDir, 'CHANGELOG.md');
  const header = `# Changelog\n\nTất cả các thay đổi đáng chú ý của dự án Zalo Bot sẽ được ghi lại trong tài liệu này.\n\n`;

  let currentContent = '';
  if (fs.existsSync(changelogPath)) {
    currentContent = fs.readFileSync(changelogPath, 'utf8');
  }

  let finalContent = '';
  if (!currentContent) {
    finalContent = header + changelogSection;
  } else if (currentContent.startsWith('# Changelog')) {
    const versionHeaderRegex = new RegExp(`^## \\[v${version.replace(/\./g, '\\.')}\\][\\s\\S]*?(?=^## \\[|$)`, 'm');
    const existingSectionMatch = currentContent.match(versionHeaderRegex);

    if (existingSectionMatch) {
      finalContent = currentContent.replace(versionHeaderRegex, changelogSection);
    } else {
      const afterHeader = currentContent.replace(/^# Changelog[\s\S]*?(?=^## \[|$)/m, '');
      finalContent = header + changelogSection + afterHeader;
    }
  } else {
    finalContent = header + changelogSection + currentContent;
  }

  fs.writeFileSync(changelogPath, finalContent, 'utf8');
}

export function updateChangelogNow(pendingMessage = '') {
  const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const version = (rootPkg.version || '1.0.0').replace(/^v/, '');

  const commits = getCommitsSinceLastTag(pendingMessage);
  const categories = categorizeCommits(commits);
  const section = generateMarkdownSection(version, categories);

  updateChangelog(version, section);
}

// If executed directly as CLI:
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  let pendingMsg = '';
  const msgFileIndex = process.argv.indexOf('--msg-file');
  if (msgFileIndex !== -1 && process.argv[msgFileIndex + 1]) {
    try {
      pendingMsg = fs.readFileSync(process.argv[msgFileIndex + 1], 'utf8');
    } catch {}
  } else if (process.argv[2] && !process.argv[2].startsWith('--')) {
    pendingMsg = process.argv[2];
  }

  updateChangelogNow(pendingMsg);
  runCommand('git add CHANGELOG.md');
  console.log('📝 CHANGELOG.md đã được cập nhật tự động.');
}

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

function runCommand(cmd, options = {}) {
  try {
    return execSync(cmd, { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], ...options }).trim();
  } catch {
    return '';
  }
}

function bumpSemver(currentVersion, bumpType) {
  const clean = currentVersion.replace(/^v/, '');
  const parts = clean.split('.').map((p) => parseInt(p, 10) || 0);
  while (parts.length < 3) parts.push(0);

  let [major, minor, patch] = parts;

  if (bumpType === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (bumpType === 'minor') {
    minor += 1;
    patch = 0;
  } else if (bumpType === 'patch') {
    patch += 1;
  } else if (/^\d+\.\d+\.\d+/.test(bumpType.replace(/^v/, ''))) {
    return bumpType.replace(/^v/, '');
  } else {
    console.error(`❌ Kiểu tăng version không hợp lệ: "${bumpType}". Vui lòng dùng: patch | minor | major hoặc version cụ thể (VD: 1.1.0).`);
    process.exit(1);
  }

  return `${major}.${minor}.${patch}`;
}

function getCommitsSinceLastTag() {
  const lastTag = runCommand('git describe --tags --abbrev=0');
  const gitLogCommand = lastTag
    ? `git log ${lastTag}..HEAD --pretty=format:"%h%x09%s"`
    : `git log -n 50 --pretty=format:"%h%x09%s"`;

  const output = runCommand(gitLogCommand);
  if (!output) return [];

  return output
    .split('\n')
    .map((line) => {
      const [hash, ...rest] = line.split('\t');
      return { hash: hash?.trim(), subject: rest.join('\t')?.trim() };
    })
    .filter((item) => item.hash && item.subject);
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
    // Skip release commits
    if (/^chore\(release\):/i.test(s) || /^release:/i.test(s)) continue;

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

  if (categories.feat.length > 0) {
    hasEntries = true;
    section += `### 🚀 Tính năng mới (Features)\n`;
    for (const c of categories.feat) {
      section += `- ${c.subject} (${c.hash})\n`;
    }
    section += `\n`;
  }

  if (categories.fix.length > 0) {
    hasEntries = true;
    section += `### 🐛 Sửa lỗi (Bug Fixes)\n`;
    for (const c of categories.fix) {
      section += `- ${c.subject} (${c.hash})\n`;
    }
    section += `\n`;
  }

  if (categories.perf.length > 0 || categories.refactor.length > 0) {
    hasEntries = true;
    section += `### ⚡ Cải tiến & Tối ưu (Improvements)\n`;
    for (const c of [...categories.perf, ...categories.refactor]) {
      section += `- ${c.subject} (${c.hash})\n`;
    }
    section += `\n`;
  }

  if (categories.chore.length > 0 || categories.other.length > 0) {
    hasEntries = true;
    section += `### 🔧 Bảo trì & Khác (Maintenance)\n`;
    for (const c of [...categories.chore, ...categories.other]) {
      section += `- ${c.subject} (${c.hash})\n`;
    }
    section += `\n`;
  }

  if (!hasEntries) {
    section += `- Cập nhật và nâng cấp hệ thống trợ lý Zalo Bot.\n\n`;
  }

  return section;
}

function updateChangelog(newVersion, changelogSection) {
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
    const afterHeader = currentContent.replace(/^# Changelog[\s\S]*?(?=^## \[|$)/m, '');
    finalContent = header + changelogSection + afterHeader;
  } else {
    finalContent = header + changelogSection + currentContent;
  }

  fs.writeFileSync(changelogPath, finalContent, 'utf8');
  console.log(`📝 Đã cập nhật CHANGELOG.md cho phiên bản v${newVersion}`);
}

function updatePackageJsonVersions(newVersion) {
  for (const relativePath of PACKAGE_PATHS) {
    const fullPath = path.join(rootDir, relativePath);
    if (!fs.existsSync(fullPath)) continue;

    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    data.version = newVersion;
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`📦 Đã cập nhật version -> ${newVersion} tại ${relativePath}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const bumpType = args[0] || 'patch';
  const noGit = args.includes('--no-git');

  const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const currentVersion = rootPkg.version || '1.0.0';
  const newVersion = bumpSemver(currentVersion, bumpType);

  console.log(`\n🚀 Bắt đầu phát hành phiên bản mới: v${currentVersion} ➔ v${newVersion} (${bumpType})\n`);

  // 1. Cập nhật các package.json
  updatePackageJsonVersions(newVersion);

  // 2. Thu thập git commit và sinh changelog
  const commits = getCommitsSinceLastTag();
  const categories = categorizeCommits(commits);
  const changelogSection = generateMarkdownSection(newVersion, categories);
  updateChangelog(newVersion, changelogSection);

  // 3. Git commit & tag
  if (!noGit) {
    try {
      console.log(`\n🔖 Đang tạo Git Commit và Tag cho v${newVersion}...`);
      runCommand(`git add ${PACKAGE_PATHS.join(' ')} CHANGELOG.md`);
      runCommand(`git commit -m "chore(release): bump version to v${newVersion}"`);
      runCommand(`git tag -a "v${newVersion}" -m "Release v${newVersion}"`);
      console.log(`✅ Đã tạo commit và tag: v${newVersion}`);
    } catch (err) {
      console.warn(`⚠️ Không thể tạo git tag/commit tự động: ${err.message}`);
    }
  }

  console.log(`\n🎉 HOÀN TẤT BUMP VERSION: v${newVersion}`);
  console.log(`💡 Để đẩy lên GitHub/server, chạy lệnh:`);
  console.log(`   git push origin main --tags\n`);
}

main().catch((err) => {
  console.error('Lỗi khi chạy release script:', err);
  process.exit(1);
});

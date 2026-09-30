#!/usr/bin/env node
/**
 * 让 index.json 跟随规则文件自动更新。
 *
 * 对每个发生变化的规则文件：对应条目的 rev 加一，并用规则文件里的
 * baseUrl / iconUrl / description 刷新条目的 site / badge / intro。
 * 由 .github/workflows/sync-rule-index.yml 在推送到 main 之后自动运行，
 * 也可以在本机手动执行。
 *
 * 用法：
 *   node scripts/sync-index.mjs --dry-run --all      预览全库改动，不写文件
 *   node scripts/sync-index.mjs --all                按当前工作区全部规则对齐
 *   node scripts/sync-index.mjs --files=a.json,b.json
 *   node scripts/sync-index.mjs --dry-run            按 git 差异判断改动的规则
 *
 * 选项：
 *   --dry-run       只打印将要发生的改动
 *   --all           处理仓库内所有规则文件（默认只处理 git 差异里的规则文件）
 *   --files=a,b     处理指定规则文件（逗号分隔）
 *   --no-intro      不同步 intro，保留 index.json 里手写的简介
 *   --root=<dir>    指定仓库根目录，默认脚本的上一级目录（用于测试）
 *
 * 环境变量：
 *   GITHUB_BEFORE / GITHUB_AFTER  推送前后的提交，用于计算改动的规则文件
 *   GITHUB_STEP_SUMMARY           存在时写入 GitHub 任务摘要
 *   SYNC_INDEX_NO_INTRO=1         等价于 --no-intro
 */

import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const indexFileName = 'index.json';

const argv = process.argv.slice(2);
const boolFlags = new Set(
  argv.filter((arg) => arg.startsWith('--') && !arg.includes('=')),
);
const valueFlags = new Map(
  argv
    .filter((arg) => arg.startsWith('--') && arg.includes('='))
    .map((arg) => [
      arg.slice(0, arg.indexOf('=')),
      arg.slice(arg.indexOf('=') + 1),
    ]),
);

const root = resolve(valueFlags.get('--root') ?? scriptRoot);
const indexPath = join(root, indexFileName);
const dryRun = boolFlags.has('--dry-run');
const syncIntro =
  !boolFlags.has('--no-intro') && process.env.SYNC_INDEX_NO_INTRO !== '1';
const inActions = process.env.GITHUB_ACTIONS === 'true';

const notes = [];
const errors = [];

function note(message) {
  console.log(message);
}

function warn(message) {
  const single = message.replace(/\s*\n\s*/g, ' ');
  notes.push(single);
  console.log(inActions ? `::warning::${single}` : `警告：${single}`);
}

function fail(message) {
  errors.push(message);
  const single = message.replace(/\s*\n\s*/g, ' ');
  console.log(inActions ? `::error::${single}` : `错误：${single}`);
}

function isRuleFile(name) {
  return name.endsWith('.json') && basename(name) !== indexFileName;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** 站点链接统一带结尾斜杠，与现有条目一致。 */
function normalizeSite(value) {
  const site = text(value);
  if (!site) return '';
  return site.endsWith('/') ? site : `${site}/`;
}

function gitChangedNames(from, to) {
  const result = spawnSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACMR', from, to],
    { cwd: root, encoding: 'utf8' },
  );
  if (result.status !== 0) return null;
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function changedRuleFiles() {
  const before = text(process.env.GITHUB_BEFORE);
  const after = text(process.env.GITHUB_AFTER) || 'HEAD';
  const attempts = [];
  if (before && !/^0+$/.test(before)) attempts.push([before, after]);
  attempts.push(['HEAD^', 'HEAD']);
  for (const [from, to] of attempts) {
    const names = gitChangedNames(from, to);
    if (names) return names.filter(isRuleFile);
  }
  warn('无法通过 git 差异确定改动的规则文件，本次不修改 index.json。');
  return [];
}

function availableRuleFiles() {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isRuleFile(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function selectTargets() {
  const explicit = (valueFlags.get('--files') ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  let candidates;
  if (boolFlags.has('--all')) candidates = availableRuleFiles();
  else if (explicit.length > 0) candidates = explicit;
  else candidates = changedRuleFiles();
  const unique = [...new Set(candidates.map((name) => basename(name)))].filter(
    isRuleFile,
  );
  return unique.filter((name) => existsSync(join(root, name))).sort();
}

function refreshEntry(entry, rule) {
  const changes = [];
  const previousRev = Number.isInteger(entry.rev) ? entry.rev : 0;
  entry.rev = previousRev + 1;
  changes.push(`rev ${previousRev} → ${entry.rev}`);

  const site = normalizeSite(rule.baseUrl);
  if (site && site !== entry.site) {
    changes.push(`site ${entry.site ?? '（空）'} → ${site}`);
    entry.site = site;
  }

  const badge = text(rule.iconUrl);
  if (badge && badge !== entry.badge) {
    changes.push(`badge ${entry.badge ?? '（空）'} → ${badge}`);
    entry.badge = badge;
  }

  if (syncIntro) {
    const intro = text(rule.description);
    if (intro && intro !== entry.intro) {
      changes.push(`intro ${entry.intro ?? '（空）'} → ${intro}`);
      entry.intro = intro;
    }
  }

  return changes;
}

function writeStepSummary(lines) {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (!path) return;
  try {
    appendFileSync(path, `${lines.join('\n')}\n`);
  } catch {
    /* 摘要写入失败不影响结果 */
  }
}

function main() {
  if (!existsSync(indexPath)) {
    fail(`找不到 ${indexPath}`);
    return;
  }

  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  if (!Array.isArray(index.entries)) {
    fail(`${indexFileName} 缺少 entries 数组`);
    return;
  }

  const byKey = new Map(index.entries.map((entry) => [entry.key, entry]));
  const byRef = new Map(
    index.entries.filter((entry) => entry.ref).map((entry) => [entry.ref, entry]),
  );

  const targets = selectTargets();
  const report = [];
  const summary = [];

  if (targets.length === 0) {
    note('没有需要处理的规则文件。');
    return;
  }

  for (const file of targets) {
    let rule;
    try {
      rule = JSON.parse(readFileSync(join(root, file), 'utf8'));
    } catch (error) {
      fail(`${file} 不是合法的 JSON：${error.message}`);
      continue;
    }
    if (rule === null || typeof rule !== 'object' || Array.isArray(rule)) {
      fail(`${file} 的根节点不是 JSON 对象`);
      continue;
    }

    const entry = byKey.get(rule.id) ?? byRef.get(file);
    if (!entry) {
      warn(
        `${file}（id=${rule.id ?? basename(file, '.json')}）在 ${indexFileName} 里没有对应条目，已跳过；新增规则需要手动补一条 entries。`,
      );
      continue;
    }
    if (entry.ref && entry.ref !== file) {
      warn(`${entry.key} 的 ref 是 ${entry.ref}，实际文件是 ${file}，请手动确认。`);
    }
    if (text(rule.name) && text(rule.name) !== text(entry.title)) {
      warn(
        `${entry.key} 的 title 是「${entry.title}」，规则文件里的 name 是「${rule.name}」，请手动确认。`,
      );
    }

    const changes = refreshEntry(entry, rule);
    report.push(`${file}（${entry.key}）：${changes.join('，')}`);
    summary.push(`- \`${file}\`（${entry.key}）：${changes.join('，')}`);
  }

  if (errors.length > 0) {
    return;
  }

  if (report.length === 0) {
    note('改动的规则文件都没有对应条目，index.json 未修改。');
    return;
  }

  index.synced = new Date().toISOString();
  const next = `${JSON.stringify(index, null, 2)}\n`;
  const current = readFileSync(indexPath, 'utf8');

  if (next === current) {
    note('index.json 已是最新。');
    return;
  }

  note(`${dryRun ? '将要更新' : '已更新'} ${indexFileName}：`);
  for (const line of report) note(`  ${line}`);

  if (!dryRun) writeFileSync(indexPath, next, 'utf8');

  writeStepSummary([
    `## 规则索引${dryRun ? '（预览）' : ''}同步`,
    '',
    `处理 ${report.length} 个规则文件：`,
    ...summary,
  ]);
}

main();

if (notes.length > 0) {
  note(`共 ${notes.length} 条提示，请人工确认。`);
}

process.exit(errors.length > 0 ? 1 : 0);

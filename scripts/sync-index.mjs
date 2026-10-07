#!/usr/bin/env node
/**
 * 同步规则内容指纹、版本与展示信息。零依赖，不读取 Git 历史。
 * 默认检查全库；重复执行、重排 JSON 对象字段或调整缩进不会重复升版。
 * 旧条目没有 contentHash 时只建立基线，保留已有 rev，避免全库误报更新。
 *
 * node scripts/sync-index.mjs --dry-run
 * node scripts/sync-index.mjs --check
 * node scripts/sync-index.mjs --files=a.json,b.json --no-intro
 */
import { createHash } from 'node:crypto';
import {
  appendFileSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const scriptRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const inActions = process.env.GITHUB_ACTIONS === 'true';

function diagnostic(level, message) {
  const single = message.replace(/\s*\n\s*/g, ' ');
  const escaped = single.replaceAll('%', '%25').replaceAll('\r', '%0D');
  console.error(inActions ? `::${level}::${escaped}` : `${level}: ${single}`);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isRuleFile(name) {
  return typeof name === 'string' && /^[^/\\:]+\.json$/.test(name) && name !== 'index.json';
}

function readJson(path) {
  try {
    const value = JSON.parse(readFileSync(path, 'utf8'));
    if (!isObject(value)) throw new Error('根节点必须是 JSON 对象');
    return value;
  } catch (error) {
    throw new Error(`${path}: ${error.message}`);
  }
}

// 仅忽略对象键顺序和 JSON 格式；数组顺序与脚本/正则字符串必须保留。
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function contentHash(rule) {
  return createHash('sha256').update(canonical(rule)).digest('hex');
}

function summary(lines) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  try {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
  } catch (error) {
    diagnostic('warning', `无法写入任务摘要：${error.message}`);
  }
}

function loadCatalog(root) {
  const index = readJson(join(root, 'index.json'));
  if (index.format !== 'anx-rulehub/2' || !Array.isArray(index.entries)) {
    throw new Error('index.json 必须使用 anx-rulehub/2 格式并包含 entries 数组');
  }
  const files = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isRuleFile(entry.name))
    .map((entry) => entry.name).sort();
  const rules = new Map();
  const ids = new Set();
  for (const file of files) {
    const rule = readJson(join(root, file));
    if (rule.format !== 'anx-rule/2' || !text(rule.id) || !text(rule.name)) {
      throw new Error(`${file}: 缺少有效的 format / id / name`);
    }
    if (ids.has(rule.id)) throw new Error(`${file}: 重复的规则 id ${rule.id}`);
    ids.add(rule.id);
    let url;
    try { url = new URL(rule.baseUrl); } catch { /* 由下面的检查报告 */ }
    if (!url || !['http:', 'https:'].includes(url.protocol)) {
      throw new Error(`${file}: baseUrl 必须是 HTTP(S) 地址`);
    }
    rules.set(file, rule);
  }
  const keys = new Set();
  const refs = new Set();
  for (const entry of index.entries) {
    if (!isObject(entry) || !text(entry.key) || !text(entry.title) || !isRuleFile(entry.ref)) {
      throw new Error('index.json: 条目必须有 key / title 和仓库根目录下的规则 ref');
    }
    if (keys.has(entry.key) || refs.has(entry.ref)) {
      throw new Error(`index.json: 重复的 key 或 ref：${entry.key} / ${entry.ref}`);
    }
    keys.add(entry.key);
    refs.add(entry.ref);
    if (!Number.isSafeInteger(entry.rev) || entry.rev < 1) {
      throw new Error(`${entry.key}: rev 必须是正的安全整数`);
    }
    if (entry.contentHash !== undefined && !/^[a-f0-9]{64}$/.test(entry.contentHash)) {
      throw new Error(`${entry.key}: contentHash 必须是 SHA-256 十六进制摘要`);
    }
    const rule = rules.get(entry.ref);
    if (!rule) throw new Error(`${entry.key}: ref 指向不存在的规则 ${entry.ref}`);
    if (rule.id !== entry.key) {
      throw new Error(`${entry.ref}: 规则 id ${rule.id} 与索引 key ${entry.key} 不一致`);
    }
    if (text(rule.name) !== text(entry.title)) {
      diagnostic('warning', `${entry.key}: title「${entry.title}」与 name「${rule.name}」不一致，保留手写标题`);
    }
  }
  for (const file of files) {
    if (!refs.has(file)) diagnostic('warning', `${file} 未登记到 index.json，已跳过同步；新增规则仍需手动补 entries`);
  }
  return { index, rules };
}

function refreshEntry(entry, rule, syncIntro) {
  const changes = [];
  const hash = contentHash(rule);
  if (entry.contentHash !== hash) {
    if (entry.contentHash === undefined) {
      changes.push(`建立内容指纹（保留 rev ${entry.rev}）`);
    } else {
      if (entry.rev === Number.MAX_SAFE_INTEGER) throw new Error(`${entry.key}: rev 已达到安全整数上限`);
      changes.push(`rev ${entry.rev} → ${entry.rev + 1}`);
      entry.rev += 1;
    }
    entry.contentHash = hash;
  }
  const site = text(rule.baseUrl).replace(/\/?$/, '/');
  for (const [field, value] of [
    ['site', site], ['badge', text(rule.iconUrl)],
    ...(syncIntro ? [['intro', text(rule.description)]] : []),
  ]) {
    if (value && value !== entry[field]) {
      entry[field] = value;
      changes.push(`更新 ${field}`);
    }
  }
  return changes;
}

function main() {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean' }, check: { type: 'boolean' },
      all: { type: 'boolean' }, files: { type: 'string' },
      'no-intro': { type: 'boolean' }, root: { type: 'string' },
    },
  });
  if (values.all && values.files !== undefined) throw new Error('--all 与 --files 不能同时使用');
  const root = resolve(values.root ?? scriptRoot);
  // 先校验整个仓库，再生成任何改动；错误不能留下部分更新的索引。
  const { index, rules } = loadCatalog(root);
  const targets = values.files === undefined ? null : new Set(values.files.split(',').map((file) => file.trim()));
  if (targets) {
    for (const file of targets) {
      if (!isRuleFile(file) || !rules.has(file)) throw new Error(`无效或不存在的规则文件：${file}`);
    }
  }
  if (values.check) {
    const message = `校验通过：${rules.size} 个规则文件，${index.entries.length} 个索引条目。`;
    console.log(message);
    summary(['## 规则索引校验', '', message]);
    return;
  }

  const syncIntro = !values['no-intro'] && process.env.SYNC_INDEX_NO_INTRO !== '1';
  const report = [];
  for (const entry of index.entries) {
    if (targets && !targets.has(entry.ref)) continue;
    const changes = refreshEntry(entry, rules.get(entry.ref), syncIntro);
    if (changes.length) report.push(`- ${entry.ref}（${entry.key}）：${changes.join('，')}`);
  }
  if (report.length === 0) {
    console.log('index.json 已是最新，无需修改。');
    summary(['## 规则索引同步', '', '无改动，版本与 synced 保持不变。']);
    return;
  }
  index.synced = new Date().toISOString();
  if (!values['dry-run']) {
    const indexPath = join(root, 'index.json');
    const temporary = `${indexPath}.${process.pid}.tmp`;
    try {
      writeFileSync(temporary, `${JSON.stringify(index, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      renameSync(temporary, indexPath);
    } finally {
      rmSync(temporary, { force: true });
    }
  }
  const title = `${values['dry-run'] ? '将要更新' : '已更新'} ${report.length} 个索引条目`;
  console.log(`${title}：\n${report.join('\n')}`);
  summary([`## 规则索引同步${values['dry-run'] ? '（预览）' : ''}`, '', title, ...report]);
}

try {
  main();
} catch (error) {
  diagnostic('error', error.message);
  summary(['## 规则索引同步失败', '', error.message]);
  process.exitCode = 1;
}

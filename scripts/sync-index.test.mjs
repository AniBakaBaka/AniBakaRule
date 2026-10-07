import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = join(dirname(fileURLToPath(import.meta.url)), 'sync-index.mjs');

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'sync-index-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (name, data) => writeFileSync(join(root, name), `${JSON.stringify(data, null, 2)}\n`);
  const read = (name = 'index.json') => JSON.parse(readFileSync(join(root, name), 'utf8'));
  const raw = () => readFileSync(join(root, 'index.json'), 'utf8');
  const rule = (id) => ({
    format: 'anx-rule/2', id, name: id, baseUrl: `https://${id}.example`,
    iconUrl: `https://${id}.example/icon.png`, description: `${id} intro`,
    search: [{ op: 'fetch', url: '/search' }, { op: 'searchList', selectors: ['a'] }],
  });
  write('a.json', rule('a'));
  write('b.json', rule('b'));
  write('index.json', {
    format: 'anx-rulehub/2', synced: '2020-01-01T00:00:00.000Z',
    entries: ['a', 'b'].map((key) => ({
      key, title: key, ref: `${key}.json`, rev: 5, intro: 'custom intro', labels: ['高清'],
    })),
  });
  function run(args = [], overrides = {}, success = true) {
    const env = { ...process.env };
    for (const name of ['GITHUB_ACTIONS', 'GITHUB_STEP_SUMMARY', 'SYNC_INDEX_NO_INTRO']) delete env[name];
    const result = spawnSync(process.execPath, [script, `--root=${root}`, ...args], {
      encoding: 'utf8', env: { ...env, ...overrides },
    });
    const output = result.stdout + result.stderr;
    if (success) assert.equal(result.status, 0, output);
    else assert.notEqual(result.status, 0, output);
    return output;
  }
  return { root, write, read, raw, run };
}

test('legacy migration preserves revisions; reruns preserve every byte and synced', (t) => {
  const f = fixture(t);
  f.run();
  const index = f.read();
  assert.deepEqual(index.entries.map((e) => e.rev), [5, 5]);
  assert.match(index.entries[0].contentHash, /^[a-f0-9]{64}$/);
  assert.equal(index.entries[0].site, 'https://a.example/');
  assert.equal(index.entries[0].badge, 'https://a.example/icon.png');
  assert.equal(index.entries[0].intro, 'a intro');
  assert.deepEqual(index.entries[0].labels, ['高清']);
  const synced = f.raw();
  f.run();
  f.run(['--all']);
  assert.equal(f.raw(), synced);
  assert.equal(readdirSync(f.root).some((name) => name.endsWith('.tmp')), false);
});

test('changing one rule only bumps that rule during a full scan', (t) => {
  const f = fixture(t);
  f.run();
  const baseline = f.read();
  const rule = f.read('a.json');
  rule.search[0].url = '/updated-search';
  f.write('a.json', rule);
  f.run();
  const updated = f.read();
  assert.equal(updated.entries[0].rev, baseline.entries[0].rev + 1);
  assert.notEqual(updated.entries[0].contentHash, baseline.entries[0].contentHash);
  assert.deepEqual(updated.entries[1], baseline.entries[1]);
  const saved = f.raw();
  f.run();
  assert.equal(f.raw(), saved);
});

test('mixed migration only bumps a changed rule with an existing fingerprint', (t) => {
  const f = fixture(t);
  f.run(['--files=a.json']);
  const rule = f.read('a.json');
  rule.search[0].url = '/updated-search';
  f.write('a.json', rule);
  f.run();
  assert.deepEqual(f.read().entries.map((e) => e.rev), [6, 5]);
  assert.match(f.read().entries[1].contentHash, /^[a-f0-9]{64}$/);
});

test('default full scan catches changes across multiple rules without Git history', (t) => {
  const f = fixture(t);
  f.run();
  for (const id of ['a', 'b']) {
    const rule = f.read(`${id}.json`);
    rule.search[0].url = `/new-${id}`;
    f.write(`${id}.json`, rule);
  }
  f.run([], { GITHUB_BEFORE: 'unavailable', GITHUB_AFTER: 'unavailable' });
  assert.deepEqual(f.read().entries.map((e) => e.rev), [6, 6]);
  const synced = f.raw();
  f.run();
  assert.equal(f.raw(), synced);
});

test('formatting and object key order do not bump; array order and string whitespace do', (t) => {
  const f = fixture(t);
  f.run();
  const baseline = f.raw();
  const rule = f.read('a.json');
  rule.search[0] = { url: '/search', op: 'fetch' };
  writeFileSync(join(f.root, 'a.json'), JSON.stringify(Object.fromEntries(Object.entries(rule).reverse())));
  f.run();
  assert.equal(f.raw(), baseline);
  rule.search.reverse();
  f.write('a.json', rule);
  f.run();
  assert.equal(f.read().entries[0].rev, 6);
  rule.search[1].url += ' ';
  f.write('a.json', rule);
  f.run();
  assert.equal(f.read().entries[0].rev, 7);
  assert.equal(f.read().entries[1].rev, 5);
});

test('explicit files are deduplicated; other entries stay untouched', (t) => {
  const f = fixture(t);
  const untouched = f.read().entries[1];
  f.run(['--files=a.json,a.json']);
  assert.equal(f.read().entries[0].rev, 5);
  assert.deepEqual(f.read().entries[1], untouched);
  const saved = f.raw();
  f.run(['--files=a.json']);
  assert.equal(f.raw(), saved);
});

test('dry-run and check validate without writing index or fingerprints', (t) => {
  const f = fixture(t);
  const before = f.raw();
  assert.match(f.run(['--dry-run']), /将要更新 2 个/);
  assert.equal(f.raw(), before);
  assert.match(f.run(['--check']), /校验通过/);
  assert.equal(f.raw(), before);
});

for (const mode of ['flag', 'environment']) {
  test(`no-intro via ${mode} preserves custom text; later metadata refresh does not bump again`, (t) => {
    const f = fixture(t);
    f.run(mode === 'flag' ? ['--no-intro'] : [], mode === 'environment' ? { SYNC_INDEX_NO_INTRO: '1' } : {});
    assert.equal(f.read().entries[0].intro, 'custom intro');
    f.run();
    assert.equal(f.read().entries[0].intro, 'a intro');
    assert.equal(f.read().entries[0].rev, 5);
  });
}

test('unregistered rules warn without inventing index metadata', (t) => {
  const f = fixture(t);
  f.write('c.json', { ...f.read('a.json'), id: 'c', name: 'c' });
  assert.match(f.run(), /c.json 未登记/);
  assert.equal(f.read().entries.length, 2);
});

test('handwritten titles are kept with warning', (t) => {
  const f = fixture(t);
  const index = f.read();
  index.entries[0].title = 'Custom title';
  f.write('index.json', index);
  assert.match(f.run(), /保留手写标题/);
  assert.equal(f.read().entries[0].title, 'Custom title');
});

test('recipe-based rules remain supported by the lightweight catalog check', (t) => {
  const f = fixture(t);
  const rule = f.read('a.json');
  delete rule.search;
  rule.recipe = { type: 'macCms' };
  f.write('a.json', rule);
  f.run(['--check']);
});

const invalidCatalogs = {
  'duplicate key': (index) => { index.entries[1].key = 'a'; },
  'duplicate ref': (index) => { index.entries[1].ref = 'a.json'; },
  'mismatched id': (index) => { index.entries[0].key = 'wrong'; },
  'deleted rule': (index) => { index.entries[0].ref = 'missing.json'; },
  'path traversal': (index) => { index.entries[0].ref = '../a.json'; },
  'invalid revision': (index) => { index.entries[0].rev = '5'; },
  'negative revision': (index) => { index.entries[0].rev = -1; },
  'overflow revision': (index) => {
    index.entries[0].rev = Number.MAX_SAFE_INTEGER;
    index.entries[0].contentHash = '0'.repeat(64);
  },
  'invalid fingerprint': (index) => { index.entries[0].contentHash = 'bad'; },
  'invalid index format': (index) => { index.format = 'other'; },
  'non-object entry': (index) => { index.entries.push(null); },
};
for (const [name, mutate] of Object.entries(invalidCatalogs)) {
  test(`${name} fails without partial writes`, (t) => {
    const f = fixture(t);
    const index = f.read();
    mutate(index);
    f.write('index.json', index);
    const before = f.raw();
    f.run([], {}, false);
    assert.equal(f.raw(), before);
  });
}

for (const [name, content] of [
  ['invalid JSON', '{'], ['array root', '[]'], ['null root', 'null'],
  ['duplicate rule id', JSON.stringify({ format: 'anx-rule/2', id: 'a', name: 'a', baseUrl: 'https://a.example' })],
  ['invalid URL', JSON.stringify({ format: 'anx-rule/2', id: 'b', name: 'b', baseUrl: 'file:///tmp' })],
]) {
  test(`${name} in a later rule prevents every write`, (t) => {
    const f = fixture(t);
    writeFileSync(join(f.root, 'b.json'), content);
    const before = f.raw();
    f.run([], {}, false);
    assert.equal(f.raw(), before);
  });
}

test('malformed index has a readable diagnostic, not an uncaught stack', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.root, 'index.json'), '{');
  const output = f.run([], {}, false);
  assert.match(output, /index.json/);
  assert.doesNotMatch(output, /at main/);
});

test('bad CLI selections fail loudly instead of silently selecting a basename', (t) => {
  const f = fixture(t);
  const before = f.raw();
  for (const args of [
    ['--files=../a.json'], ['--files=sub/a.json'], ['--files=index.json'],
    ['--files=missing.json'], ['--files='], ['--all', '--files=a.json'], ['--dry-rnu'],
  ]) f.run(args, {}, false);
  assert.equal(f.raw(), before);
});

test('Actions summary covers preview, no-op, and failure', (t) => {
  const f = fixture(t);
  const path = join(f.root, 'summary.md');
  const env = { GITHUB_STEP_SUMMARY: path, GITHUB_ACTIONS: 'true' };
  f.run(['--dry-run'], env);
  assert.match(readFileSync(path, 'utf8'), /预览/);
  f.run();
  f.run([], env);
  assert.match(readFileSync(path, 'utf8'), /无改动/);
  writeFileSync(join(f.root, 'b.json'), '{');
  assert.match(f.run([], env, false), /::error::/);
  assert.match(readFileSync(path, 'utf8'), /失败/);
});

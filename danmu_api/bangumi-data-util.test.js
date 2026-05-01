import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

const repoRoot = path.resolve(import.meta.dirname, '..');
const utilModulePath = path.join(repoRoot, 'danmu_api/utils/bangumi-data-util.js');

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('bangumi-data util remains safe for neutral bundles while buggy node-only imports would fail', async () => {
  const tempDir = makeTempDir('bangumi-neutral-bundle-');

  try {
    const currentEntry = path.join(tempDir, 'current-entry.mjs');
    const buggyEntry = path.join(tempDir, 'buggy-entry.mjs');
    const buggyUtil = path.join(tempDir, 'buggy-bangumi-data-util.mjs');

    fs.writeFileSync(
      currentEntry,
      `import { searchBangumiData } from ${JSON.stringify(utilModulePath)};\nexport default typeof searchBangumiData;\n`,
      'utf8'
    );

    fs.writeFileSync(
      buggyUtil,
      [
        "import fs from 'node:fs';",
        "import path from 'node:path';",
        "import { pipeline } from 'node:stream/promises';",
        "export function searchBangumiData() {",
        "  return [typeof fs, typeof path, typeof pipeline];",
        "}",
        ''
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      buggyEntry,
      `import { searchBangumiData } from ${JSON.stringify(buggyUtil)};\nexport default searchBangumiData;\n`,
      'utf8'
    );

    let buggyError = null;
    try {
      await build({
        entryPoints: [buggyEntry],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'neutral',
        logLevel: 'silent',
      });
    } catch (error) {
      buggyError = error;
    }

    assert.ok(buggyError, 'buggy fixture should fail neutral bundling');
    assert.match(String(buggyError), /Could not resolve \"node:(fs|path|stream\/promises)\"/);

    const result = await build({
      entryPoints: [currentEntry],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'neutral',
      logLevel: 'silent',
    });

    assert.equal(result.errors.length, 0);
    assert.ok(result.outputFiles[0].text.includes('searchBangumiData'));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('bangumi-data util should persist node cache to disk and reload it without refetching', () => {
  const tempDir = makeTempDir('bangumi-node-cache-');
  const childScriptPath = path.join(tempDir, 'run-bangumi-cache-test.mjs');
  const mockFetchPath = path.join(tempDir, 'mock-node-fetch.mjs');

  try {
    fs.mkdirSync(path.join(tempDir, '.cache'), { recursive: true });

    fs.writeFileSync(
      mockFetchPath,
      [
        "import { Readable } from 'node:stream';",
        "const payload = JSON.stringify({ items: [",
        "  {",
        "    title: '测试动画',",
        "    type: 'tv',",
        "    begin: '2024-01-01',",
        "    titleTranslate: { 'zh-Hans': ['測試動畫'] },",
        "    unusedLargeField: 'should be pruned',",
        "    sites: [",
        "      { site: 'bangumi', id: 'bgm-1', comment: '备注', unusedSiteField: 'drop-me' },",
        "      { site: 'unsupported_site', id: 'ignored-1' }",
        "    ]",
        "  },",
        "  {",
        "    title: '无目标站点动画',",
        "    type: 'tv',",
        "    sites: [{ site: 'unsupported_site', id: 'ignored-2' }]",
        "  }",
        "] });",
        '',
        'export default async function mockFetch(url) {',
        '  globalThis.__bangumiFetchCalls = (globalThis.__bangumiFetchCalls || 0) + 1;',
        '  if (globalThis.__bangumiFetchMode === \"fail\") {',
        '    throw new Error(`unexpected network during disk-cache reload: ${url}`);',
        '  }',
        '  return {',
        '    ok: true,',
        '    status: 200,',
        '    body: Readable.from([payload]),',
        '    async json() {',
        '      return JSON.parse(payload);',
        '    }',
        '  };',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    fs.writeFileSync(
      childScriptPath,
      [
        "import assert from 'node:assert';",
        "import fs from 'node:fs';",
        "import path from 'node:path';",
        "import { registerHooks } from 'node:module';",
        "import { pathToFileURL } from 'node:url';",
        '',
        'const [repoRoot, tempDir, mockFetchPath] = process.argv.slice(2);',
        'const mockFetchUrl = pathToFileURL(mockFetchPath).href;',
        'const hooks = registerHooks({',
        '  resolve(specifier, context, nextResolve) {',
        '    if (specifier === \"node-fetch\") {',
        '      return { shortCircuit: true, url: mockFetchUrl };',
        '    }',
        '    return nextResolve(specifier, context);',
        '  }',
        '});',
        '',
        'try {',
        '  process.chdir(tempDir);',
        '  globalThis.__bangumiFetchCalls = 0;',
        '  globalThis.__bangumiFetchMode = \"success\";',
        '',
        '  const globalsModule = await import(pathToFileURL(path.join(repoRoot, \"danmu_api/configs/globals.js\")).href);',
        '  const bangumiModule = await import(pathToFileURL(path.join(repoRoot, \"danmu_api/utils/bangumi-data-util.js\")).href);',
        '  const { Globals } = globalsModule;',
        '  const { clearBangumiDataCache, initBangumiData, searchBangumiData } = bangumiModule;',
        '',
        '  Globals.init({ USE_BANGUMI_DATA: \"true\", BANGUMI_DATA_CACHE_DAYS: \"7\" });',
        '  clearBangumiDataCache();',
        '  await initBangumiData(\"node\", true);',
        '',
        '  const cachePath = path.join(tempDir, \".cache\", \"bangumi-data-cache.json\");',
        '  assert.ok(fs.existsSync(cachePath), \"cache file should be created on first node init\");',
        '',
        '  const cached = JSON.parse(fs.readFileSync(cachePath, \"utf8\"));',
        '  assert.equal(cached.items.length, 1);',
        '  assert.equal(cached.items[0].title, \"测试动画\");',
        '  assert.deepEqual(Object.keys(cached.items[0]).sort(), [\"begin\", \"sites\", \"title\", \"titleTranslate\", \"type\"].sort());',
        '  assert.deepEqual(cached.items[0].sites, [{ site: \"bangumi\", id: \"bgm-1\", comment: \"备注\" }]);',
        '',
        '  const firstResults = searchBangumiData(\"测试动画\", [\"bangumi\"]);',
        '  assert.equal(firstResults.length, 1);',
        '  const fetchCallsAfterWarmup = globalThis.__bangumiFetchCalls;',
        '  assert.ok(fetchCallsAfterWarmup >= 1, \"first init should fetch remote bangumi data\");',
        '',
        '  clearBangumiDataCache();',
        '  globalThis.__bangumiFetchMode = \"fail\";',
        '  await initBangumiData(\"node\", true);',
        '',
        '  const secondResults = searchBangumiData(\"测试动画\", [\"bangumi\"]);',
        '  assert.equal(secondResults.length, 1);',
        '  assert.equal(globalThis.__bangumiFetchCalls, fetchCallsAfterWarmup, \"disk reload should not refetch after cache file exists\");',
        '',
        '  console.log(JSON.stringify({ fetchCallsAfterWarmup, finalFetchCalls: globalThis.__bangumiFetchCalls }));',
        '} finally {',
        '  hooks.deregister();',
        '}',
        ''
      ].join('\n'),
      'utf8'
    );

    const run = spawnSync(process.execPath, [childScriptPath, repoRoot, tempDir, mockFetchPath], {
      encoding: 'utf8',
      cwd: repoRoot,
    });

    assert.equal(
      run.status,
      0,
      `child verification failed\nSTDOUT:\n${run.stdout || '(empty)'}\nSTDERR:\n${run.stderr || '(empty)'}`
    );

    const summaryLine = run.stdout.trim().split('\n').filter(Boolean).at(-1);
    assert.ok(summaryLine, 'child process should emit a JSON summary line');

    const summary = JSON.parse(summaryLine);
    assert.ok(summary.fetchCallsAfterWarmup >= 1);
    assert.equal(summary.finalFetchCalls, summary.fetchCallsAfterWarmup);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

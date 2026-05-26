import test from 'node:test';
import assert from 'node:assert';
import { chromium } from 'playwright';

import { Globals } from './configs/globals.js';
import { Envs } from './configs/envs.js';
import { apitestJsContent } from './ui/js/apitest.js';
import { systemSettingsJsContent } from './ui/js/systemsettings.js';
import { formsControlsCssContent } from './ui/css/forms-controls.css.js';
import { responsiveCssContent } from './ui/css/responsive.css.js';
import { HTML_TEMPLATE } from './ui/template.js';
import { convertToDanmakuJson } from './utils/danmu-util.js';

test('DANMU_OFFSET UI config should expose quick timeline-offset editor metadata', () => {
  const config = Globals.init({});

  assert.equal(config.envVarConfig.DANMU_OFFSET.type, 'timeline-offset');
  assert.deepEqual(config.envVarConfig.DANMU_OFFSET.options, Envs.ALLOWED_SOURCES);
});

test('MATCH_PLATFORM_RULES config should parse valid platform order rules and ignore invalid values', () => {
  const config = Globals.init({
    MATCH_PLATFORM_RULES: 'A/S01->qq,bad,dandan&animeko;B->bad;C->qiyi;D->qiyi&;E->&qq;F->qiyi&&animeko'
  });

  assert.equal(config.envVarConfig.MATCH_PLATFORM_RULES.type, 'map');
  assert.deepEqual(config.matchPlatformRules, [
    { title: 'A', season: 1, platforms: ['qq', 'dandan&animeko'] },
    { title: 'C', season: null, platforms: ['qiyi'] }
  ]);
});

test('source detail concurrency should be configurable by environment variables', () => {
  const config = Globals.init({
    SOURCE_DETAIL_CONCURRENCY: '6',
    SOURCE_DETAIL_CONCURRENCY_BY_SOURCE: 'tencent:2,vod:3,bad,iqiyi:99,sohu:0,unknown:4'
  });

  assert.equal(config.sourceDetailConcurrency, 6);
  assert.deepEqual(config.sourceDetailConcurrencyBySource, {
    tencent: 2,
    vod: 3,
    iqiyi: 16
  });
  assert.equal(config.envVarConfig.SOURCE_DETAIL_CONCURRENCY.type, 'number');
  assert.equal(config.envVarConfig.SOURCE_DETAIL_CONCURRENCY_BY_SOURCE.type, 'text');
});

test('invalid source detail concurrency env values should fall back safely', () => {
  const config = Globals.init({
    SOURCE_DETAIL_CONCURRENCY: 'not-a-number',
    SOURCE_DETAIL_CONCURRENCY_BY_SOURCE: 'tencent:-1,vod:abc,iqiyi:0,youku:5'
  });

  assert.equal(config.sourceDetailConcurrency, 4);
  assert.deepEqual(config.sourceDetailConcurrencyBySource, { youku: 5 });
});

test('cache minutes UI config should allow 0 as disabled', () => {
  const config = Globals.init({});

  assert.equal(config.envVarConfig.SEARCH_CACHE_MINUTES.min, 0);
  assert.equal(config.envVarConfig.COMMENT_CACHE_MINUTES.min, 0);
});

test('CUSTOM_MERGE_RULES config should parse merge, route and block rules', () => {
  const config = Globals.init({
    CUSTOM_MERGE_RULES: '天气之子@bilibili -> 天气之子@dandan; 我推的孩子/S01@bahamut -> 我推的孩子/S03@dandan | E25~E35>E1~E11; A@iqiyi × B@tencent; bad@unknown -> B@tencent'
  });

  assert.equal(config.envVarConfig.CUSTOM_MERGE_RULES.type, 'custom-merge-rules');
  assert.deepEqual(config.customMergeRules, [
    {
      action: 'merge',
      secondary: { title: '天气之子', season: null, source: 'bilibili' },
      primary: { title: '天气之子', season: null, source: 'dandan' },
      routes: [],
      hasRoutes: false
    },
    {
      action: 'merge',
      secondary: { title: '我推的孩子', season: 1, source: 'bahamut' },
      primary: { title: '我推的孩子', season: 3, source: 'dandan' },
      routes: [{ sec: { start: 25, end: 35 }, prim: { start: 1, end: 11 } }],
      hasRoutes: true
    },
    {
      action: 'block',
      secondary: { title: 'A', season: null, source: 'iqiyi' },
      primary: { title: 'B', season: null, source: 'tencent' },
      routes: [],
      hasRoutes: false
    }
  ]);
});

test('CUSTOM_MERGE_RULES system settings should expose a visual custom merge rules editor', () => {
  assert.match(systemSettingsJsContent, /custom-merge-rules-panel/);
  assert.match(systemSettingsJsContent, /function\s+renderCustomMergeRulesEditor/);
  assert.match(systemSettingsJsContent, /function\s+addCustomMergeRuleItem/);
  assert.match(systemSettingsJsContent, /function\s+collectCustomMergeRuleValue/);
  assert.match(systemSettingsJsContent, /副源剧名/);
  assert.match(systemSettingsJsContent, /主源剧名/);
  assert.match(systemSettingsJsContent, /集数路由/);
  assert.match(HTML_TEMPLATE, /<option value="custom-merge-rules">自定义合并规则<\/option>/);
});

test('system settings embedded script content should be valid JavaScript', () => {
  assert.doesNotThrow(() => new Function(systemSettingsJsContent));
});

test('system settings env modal should use a structured controls-first layout', () => {
  assert.match(HTML_TEMPLATE, /env-modal-container/);
  assert.match(HTML_TEMPLATE, /env-modal-header/);
  assert.match(HTML_TEMPLATE, /env-modal-form/);
  assert.match(HTML_TEMPLATE, /env-modal-body/);
  assert.match(HTML_TEMPLATE, /env-modal-shell/);
  assert.match(HTML_TEMPLATE, /env-modal-side/);
  assert.match(HTML_TEMPLATE, /env-modal-workspace/);
  assert.match(HTML_TEMPLATE, /env-modal-value-card/);
  assert.match(HTML_TEMPLATE, /env-modal-description-card/);
  assert.match(HTML_TEMPLATE, /env-modal-footer/);
  assert.doesNotMatch(HTML_TEMPLATE, /编辑值/);
  assert.doesNotMatch(HTML_TEMPLATE, /复杂配置会自动切换为专用编辑器/);

  const valueIndex = HTML_TEMPLATE.indexOf('env-modal-value-card');
  const descriptionIndex = HTML_TEMPLATE.indexOf('env-modal-description-card');
  assert.ok(valueIndex >= 0 && descriptionIndex > valueIndex, 'description should be rendered after value editor');
});

test('system settings custom editors should expose modal-safe structure classes', () => {
  assert.match(systemSettingsJsContent, /multi-select-toolbar/);
  assert.match(systemSettingsJsContent, /selected-tags-panel/);
  assert.match(systemSettingsJsContent, /available-tags-panel/);
  assert.match(systemSettingsJsContent, /map-editor-panel/);
  assert.match(systemSettingsJsContent, /map-item-grid/);
  assert.match(systemSettingsJsContent, /timeline-offset-panel/);
  assert.match(systemSettingsJsContent, /timeline-offset-line-main/);
  assert.match(systemSettingsJsContent, /custom-merge-rules-list/);
  assert.match(systemSettingsJsContent, /custom-merge-rule-grid/);
  assert.match(systemSettingsJsContent, /recent-data-panel/);
});

test('system settings env modal responsive CSS should prevent squeezed custom controls', () => {
  assert.match(formsControlsCssContent, /\.env-modal-container/);
  assert.match(formsControlsCssContent, /\.env-modal-shell\s*\{[\s\S]*grid-template-columns:\s*minmax\(200px,\s*235px\)\s+minmax\(0,\s*1fr\)/);
  assert.match(formsControlsCssContent, /\.env-modal-body\s*\{[\s\S]*overflow-y:\s*auto/);
  assert.match(formsControlsCssContent, /\.env-modal-side\s*\{[\s\S]*overflow:\s*visible/);
  assert.match(formsControlsCssContent, /\.env-modal-value-card\s*\{[\s\S]*min-width:\s*0/);
  assert.match(formsControlsCssContent, /\.multi-select-toolbar\s*\{[\s\S]*flex-wrap:\s*wrap/);
  assert.match(formsControlsCssContent, /\.map-item-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)\s+auto/);
  assert.match(formsControlsCssContent, /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*\.env-modal-shell\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column/);
  assert.match(formsControlsCssContent, /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*\.env-modal-side\s*\{[\s\S]*align-self:\s*stretch;[\s\S]*width:\s*100%;[\s\S]*max-height:\s*none;[\s\S]*overflow:\s*visible/);
  assert.match(formsControlsCssContent, /\.env-modal-meta-list\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*13rem\),\s*1fr\)\)/);
  assert.match(formsControlsCssContent, /\.env-modal-meta-field\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*min-width:\s*0/);
  assert.match(formsControlsCssContent, /\.env-modal-meta-field\s+\.form-input,[\s\S]*\.env-modal-meta-field\s+\.form-select\s*\{[\s\S]*width:\s*100%/);
  assert.match(formsControlsCssContent, /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*\.env-modal-meta-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*12rem\),\s*1fr\)\)/);
  assert.match(formsControlsCssContent, /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.map-item-grid\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(formsControlsCssContent, /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.custom-merge-rule-grid\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(formsControlsCssContent, /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.timeline-offset-actions,\s*\n\s*\.custom-merge-rules-actions\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(formsControlsCssContent, /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*\.anime-cache-card-body\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*34px\s+minmax\(0,\s*1fr\)\s+auto/);
  assert.match(responsiveCssContent, /#env-modal\.modal-overlay\s*\{[\s\S]*padding:\s*0\.75rem/);
  assert.match(responsiveCssContent, /#env-modal\s+\.env-modal-container\s*\{[\s\S]*margin:\s*0/);
  assert.match(responsiveCssContent, /\.env-modal-footer\.modal-footer-compact\s*\{[\s\S]*flex-direction:\s*row/);
});

function getRectSnapshot(el) {
  const rect = el.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
    clientWidth: el.clientWidth,
    scrollWidth: el.scrollWidth
  };
}

test('system settings env modal should keep mobile controls full-width in a real browser layout', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    await page.addInitScript(() => {
      window.fetch = async () => ({ ok: true, json: async () => ({ success: true, data: [] }) });
    });
    await page.setContent(HTML_TEMPLATE, { waitUntil: 'domcontentloaded' });

    const timelineEditorMarkup = `
      <div class="timeline-offset-panel">
        <div class="timeline-offset-header">
          <div class="timeline-offset-title">时间轴偏移规则</div>
          <div class="timeline-offset-actions">
            <button type="button" class="btn btn-secondary btn-sm">📊 查看最近数据</button>
            <button type="button" class="btn btn-primary btn-sm">新增规则</button>
          </div>
        </div>
        <div class="timeline-offset-list"><div class="timeline-offset-empty">暂无规则</div></div>
      </div>
    `;

    const customMergeMarkup = `
      <div class="custom-merge-rules-panel">
        <div class="custom-merge-rules-header">
          <div><div class="custom-merge-rules-title">自定义合并规则</div></div>
          <div class="custom-merge-rules-actions">
            <button type="button" class="btn btn-secondary btn-sm">📊 查看最近数据</button>
            <button type="button" class="btn btn-primary btn-sm">新增规则</button>
          </div>
        </div>
        <div class="custom-merge-rules-list"><div class="custom-merge-rules-empty">暂无规则</div></div>
      </div>
    `;

    const episodeRows = Array.from({ length: 30 }, (_, index) => `
      <div class="anime-cache-episode-item">第${String(index + 1).padStart(2, '0')}集 - 很长很长的剧集标题用于测试展开后不要被压扁</div>
    `).join('');

    const recentDataMarkup = `
      <div class="recent-data-panel" style="display:block">
        <div class="recent-data-help">点击缓存卡片中的按钮快速填入。</div>
        <div id="recent-data-list">
          <div class="anime-cache-list">
            <div class="anime-cache-card">
              <div class="anime-cache-card-body">
                <div class="anime-cache-cover"></div>
                <div class="anime-cache-info">
                  <div class="anime-cache-title">很长很长的番剧标题用于测试移动端是否仍然紧凑</div>
                  <div class="anime-cache-meta">[bilibili] (30集)</div>
                </div>
                <div class="anime-cache-actions">
                  <button type="button" class="btn btn-sm btn-xs">设为副</button>
                  <button type="button" class="btn btn-primary btn-sm btn-xs">设为主</button>
                </div>
              </div>
              <div class="anime-cache-footer">
                <button type="button" class="cache-badge badge-episodes active">📺 收起剧集</button>
              </div>
              <div class="episodes-list-container" style="display:flex">${episodeRows}</div>
            </div>
          </div>
        </div>
      </div>
    `;

    async function renderModal(valueMarkup, type = 'timeline-offset') {
      await page.evaluate(({ valueMarkup, type }) => {
        document.getElementById('env-category').value = 'source';
        document.getElementById('env-key').value = 'CUSTOM_SOURCE_API_URL';
        document.getElementById('value-type').value = type;
        document.getElementById('env-description').value = '移动端布局回归测试';
        document.getElementById('value-input-container').innerHTML = valueMarkup;
        document.getElementById('env-modal').classList.add('active');
      }, { valueMarkup, type });
    }

    async function readLayout(actionSelector) {
      return page.evaluate((actionSelector) => {
        const get = (selector) => {
          const el = document.querySelector(selector);
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return {
            width: rect.width,
            height: rect.height,
            clientWidth: el.clientWidth,
            scrollWidth: el.scrollWidth,
            display: style.display,
            flexDirection: style.flexDirection,
            gridTemplateColumns: style.gridTemplateColumns,
            fontSize: style.fontSize
          };
        };
        return {
          viewport: window.innerWidth,
          container: get('.env-modal-container'),
          shell: get('.env-modal-shell'),
          side: get('.env-modal-side'),
          key: get('#env-key'),
          valueCard: get('.env-modal-value-card'),
          action: get(actionSelector)
        };
      }, actionSelector);
    }

    await renderModal(timelineEditorMarkup, 'timeline-offset');
    const timeline = await readLayout('.timeline-offset-actions');
    assert.ok(timeline.container.width <= 372, `mobile modal container should leave visible breathing room, got ${timeline.container.width}`);
    assert.ok(timeline.container.width >= 360, `mobile modal container should still be usable, got ${timeline.container.width}`);
    assert.ok(timeline.side.width >= timeline.shell.width * 0.98, `meta side should stretch with shell, got side ${timeline.side.width} / shell ${timeline.shell.width}`);
    assert.ok(timeline.key.scrollWidth <= timeline.key.clientWidth + 1, `env key should not be squeezed, got scroll ${timeline.key.scrollWidth} / client ${timeline.key.clientWidth}`);
    assert.ok(timeline.action.width >= timeline.valueCard.width * 0.85, `timeline action row should be full-width, got ${timeline.action.width} / ${timeline.valueCard.width}`);

    await renderModal(customMergeMarkup, 'custom-merge-rules');
    const customMerge = await readLayout('.custom-merge-rules-actions');
    assert.ok(customMerge.action.width >= customMerge.valueCard.width * 0.85, `custom merge actions should be full-width, got ${customMerge.action.width} / ${customMerge.valueCard.width}`);

    await renderModal(recentDataMarkup, 'custom-merge-rules');
    const recent = await page.evaluate(() => {
      const get = (selector) => {
        const el = document.querySelector(selector);
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return {
          width: rect.width,
          height: rect.height,
          display: style.display,
          gridTemplateColumns: style.gridTemplateColumns,
          whiteSpace: style.whiteSpace,
          overflow: style.overflow,
          textOverflow: style.textOverflow
        };
      };
      return {
        panel: get('.recent-data-panel'),
        card: get('.anime-cache-card-body'),
        title: get('.anime-cache-title'),
        actions: get('.anime-cache-actions'),
        episodes: get('.episodes-list-container'),
        episode: get('.anime-cache-episode-item')
      };
    });
    assert.equal(recent.card.display, 'grid');
    assert.match(recent.card.gridTemplateColumns, /^34px /);
    assert.ok(recent.card.height <= 64, `recent anime card should stay compact, got ${recent.card.height}`);
    assert.equal(recent.title.whiteSpace, 'nowrap');
    assert.equal(recent.title.textOverflow, 'ellipsis');
    assert.ok(recent.actions.width <= 118, `recent action buttons should not occupy a full row, got ${recent.actions.width}`);
    assert.equal(recent.episodes.display, 'flex');
    assert.ok(recent.episodes.height <= 222, `expanded episode list should remain scroll-contained, got ${recent.episodes.height}`);
    assert.ok(recent.episode.height >= 28, `episode rows must not be vertically squeezed, got ${recent.episode.height}`);
  } finally {
    await browser.close();
  }
});

function loadRecentDataHelper(helperName) {
  const start = systemSettingsJsContent.indexOf('function toJsStringLiteral');
  const end = systemSettingsJsContent.indexOf('function renderAnimeCachePanel');
  assert.ok(start >= 0 && end > start, 'recent data helper block should exist');
  const helperSource = systemSettingsJsContent.slice(start, end);
  return new Function(`${helperSource}; return ${helperName};`)();
}

function decodeHtmlAttr(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

test('recent anime cache action buttons should build safe inline handlers for quoted titles', () => {
  const buildAnimeCacheButtons = loadRecentDataHelper('buildAnimeCacheButtons');
  const html = buildAnimeCacheButtons(`A'B "<>&`, `qiyi'source`, 'CUSTOM_MERGE_RULES');
  const handlerAttrs = [...html.matchAll(/onclick="([^"]+)"/g)].map(match => decodeHtmlAttr(match[1]));

  assert.equal(handlerAttrs.length, 2);
  for (const handler of handlerAttrs) {
    assert.doesNotThrow(() => new Function('fillMergeEntity', handler));
  }
  assert.match(handlerAttrs[0], /fillMergeEntity\("sec", "A'B \\"<>&", "qiyi'source"\)/);
});

test('upstream COLOR_POOL env should stay available as a rich color-list compatibility variable', () => {
  const config = Globals.init({ COLOR_POOL: '16777215,16744319' });

  assert.equal(config.envVarConfig.COLOR_POOL.type, 'color-list');
  assert.equal(config.colorPool, '16777215,16744319');
});

test('CONVERT_COLOR=color should use upstream COLOR_POOL when provided', () => {
  Globals.init({
    CONVERT_COLOR: 'color',
    COLOR_POOL: '16744319',
    GROUP_MINUTE: '0',
    BLOCKED_WORDS: '',
  });

  const [converted] = convertToDanmakuJson([
    { timepoint: 1000, ct: 1, color: 16777215, content: 'hello' }
  ], 'dandan');

  assert.equal(converted.p.split(',')[2], '16744319');
});

test('API test UI should expose a debug toggle for matchAnime', () => {
  assert.match(
    apitestJsContent,
    /matchAnime:\s*\{[\s\S]*?name:\s*'debug'[\s\S]*?label:\s*'调试模式'[\s\S]*?type:\s*'select'[\s\S]*?options:\s*\['1',\s*'0'\]/,
  );
});

test('API test UI should send matchAnime debug as query string instead of JSON body', () => {
  assert.match(
    apitestJsContent,
    /config\.method === 'POST' && apiKey === 'matchAnime'[\s\S]*queryParams\.debug = params\.debug[\s\S]*delete params\.debug/,
  );
});

test('system settings should expose recent anime cache panel for merge and offset helpers', () => {
  assert.match(systemSettingsJsContent, /fetchAndShowRecentData/);
  assert.match(systemSettingsJsContent, /\/api\/cache\/animes/);
  assert.match(systemSettingsJsContent, /recent-data-panel/);
  assert.match(systemSettingsJsContent, /renderAnimeCachePanel/);
  assert.match(systemSettingsJsContent, /fillMergeEntity/);
  assert.match(systemSettingsJsContent, /fillOffsetEntity/);
  assert.match(systemSettingsJsContent, /MERGE_SOURCE_PAIRS[\s\S]*?查看最近数据/);
});

test('AI API Key connection test should send current AI_BASE_URL and AI_MODEL values from the UI', () => {
  assert.match(systemSettingsJsContent, /function\s+getEnvVariableValue\(key\)/);
  assert.match(systemSettingsJsContent, /const\s+verifyPayload\s*=\s*\{\}/);
  assert.match(systemSettingsJsContent, /getEnvVariableValue\('AI_BASE_URL'\)/);
  assert.match(systemSettingsJsContent, /getEnvVariableValue\('AI_MODEL'\)/);
  assert.match(systemSettingsJsContent, /verifyPayload\.aiBaseUrl\s*=\s*currentAiBaseUrl/);
  assert.match(systemSettingsJsContent, /verifyPayload\.aiModel\s*=\s*currentAiModel/);
  assert.match(systemSettingsJsContent, /verifyPayload\.aiApiKey\s*=\s*apiKey/);
  assert.match(systemSettingsJsContent, /body:\s*JSON\.stringify\(verifyPayload\)/);
});

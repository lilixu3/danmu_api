import test from 'node:test';
import assert from 'node:assert';

import { Globals } from './configs/globals.js';
import { applyOffset, parseOffsetRules, resolveOffsetRule } from './utils/offset-util.js';

test('parseOffsetRules should support source-scoped percent offsets', () => {
  const rules = parseOffsetRules('东方/S3/E2@tencent%:11,无职转生/S01:-5,孤独摇滚@all:3');

  assert.equal(rules.length, 3);
  assert.deepEqual(rules[0], {
    anime: '东方',
    season: 'S03',
    episode: 'E02',
    sources: ['tencent'],
    all: false,
    offset: 11,
    usePercent: true
  });
  assert.deepEqual(rules[1], {
    anime: '无职转生',
    season: 'S01',
    episode: null,
    sources: null,
    all: false,
    offset: -5,
    usePercent: false
  });
  assert.deepEqual(rules[2], {
    anime: '孤独摇滚',
    season: null,
    episode: null,
    sources: null,
    all: true,
    offset: 3,
    usePercent: false
  });
});

test('resolveOffsetRule should prefer episode-level source-specific rules', () => {
  const rules = parseOffsetRules([
    '测试番:1',
    '测试番/S01:2',
    '测试番/S01/E03:3',
    '测试番/S01/E03@all:4',
    '测试番/S01/E03@tencent:5'
  ].join(','));

  const matched = resolveOffsetRule(rules, {
    anime: '测试番',
    season: 'S01',
    episode: 'E03',
    source: 'tencent'
  });

  assert.ok(matched);
  assert.equal(matched.offset, 5);
  assert.equal(matched.usePercent, false);
});

test('applyOffset should scale all known time fields in percent mode', () => {
  const original = [{
    p: '10.00,1,16777215,[tencent]',
    m: '测试弹幕',
    t: 10,
    progress: 10000,
    timepoint: 10
  }];

  const shifted = applyOffset(original, 10, {
    usePercent: true,
    videoDuration: 100
  });

  assert.equal(shifted[0].p, '11.00,1,16777215,[tencent]');
  assert.equal(shifted[0].t, 11);
  assert.equal(shifted[0].progress, 11000);
  assert.equal(shifted[0].timepoint, 11);
});

test('resolveOffsetRule should tolerate english title case and punctuation variants', () => {
  const rules = parseOffsetRules('overlord/S01:90,re-zero/S02@bilibili:120');

  const overlordRule = resolveOffsetRule(rules, {
    anime: 'Overlord',
    season: 'S01',
    episode: 'E01',
    source: 'tencent'
  });
  assert.ok(overlordRule);
  assert.equal(overlordRule.offset, 90);

  const reZeroRule = resolveOffsetRule(rules, {
    anime: 'Re Zero',
    season: 'S02',
    episode: 'E01',
    source: 'bilibili'
  });
  assert.ok(reZeroRule);
  assert.equal(reZeroRule.offset, 120);
});

test('resolveOffsetRule should honor TITLE_MAPPING_TABLE for DANMU_OFFSET matching', () => {
  Globals.init({
    TITLE_MAPPING_TABLE: "Frieren: Beyond Journey's End->葬送的芙莉莲"
  });

  try {
    const rules = parseOffsetRules('葬送的芙莉莲/S01:5');

    const matched = resolveOffsetRule(rules, {
      anime: "Frieren: Beyond Journey's End",
      season: 'S01',
      episode: 'E01',
      source: 'tencent'
    });

    assert.ok(matched);
    assert.equal(matched.offset, 5);
  } finally {
    Globals.init({});
  }
});


test('parseOffsetRules should accept semicolon-separated rules from UI editor', () => {
  const rules = parseOffsetRules('测试番/S01/E01@tencent:5;测试番/S01/E02@iqiyi%:10');

  assert.equal(rules.length, 2);
  assert.equal(rules[0].offset, 5);
  assert.equal(rules[0].usePercent, false);
  assert.deepEqual(rules[0].sources, ['tencent']);
  assert.equal(rules[1].offset, 10);
  assert.equal(rules[1].usePercent, true);
  assert.deepEqual(rules[1].sources, ['iqiyi']);
});

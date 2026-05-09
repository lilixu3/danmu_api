import test from 'node:test';
import assert from 'node:assert/strict';
import EzdmwSource from './sources/ezdmw.js';
import { Envs } from './configs/envs.js';

const searchHtml = `
<section class="some_drama">
  <div><a href="/Index/bangumi/98626.html"><img src="https://www.ezdmw.site/Public/atlas_oss/Public/images/some_img/2530.jpg" class="img1" /></a><p><span class="play_some">1.9万</span>&nbsp;Re：从零开始的异世界生活第四季</p></div>
  <div><a href="/Index/bangumi/87021.html"><img src="/Public/images/fallback.jpg" /></a><p>&nbsp;Re：从零开始的异世界生活第三季</p></div>
</section>`;

const bangumiHtml = `
<title>Re：从零开始的异世界生活第四季第1集在线观看&下载-E站弹幕网</title>
<meta name="keywords" content="Re：从零开始的异世界生活第四季" />
<meta name="description" content="第4期于2026年4月8日起播出，全19集。">
<a class="circuit_switch1" href="/Index/video/99316.html"><span class="5">5</span></a>
<a class="circuit_switch1" href="/Index/video/99163.html"><span class="4">4</span></a>
<a class="circuit_switch1" href="/Index/video/98998.html"><span class="3">3</span></a>
<a class="circuit_switch1" href="/Index/video/98811.html"><span class="2">2</span></a>
<a class="circuit_switch1" href="/Index/video/98626.html"><span class="1">1</span></a>
<a class="circuit_switch3" href="/Index/video/98627.html"><span class="无删01">01</span></a>`;

const videoHtml = `
<iframe src="https://player.ezdmw.com/danmuku/?nk=clksdysjsh4/clksdysjsh4_01&amp;name=clksdysjsh4/clksdysjsh4_01&amp;src=resource_name=clksdysjsh4_01&amp;up=true&amp;title=Re%EF%BC%9A%E4%BB%8E%E9%9B%B6%E5%BC%80%E5%A7%8B%E7%9A%84%E5%BC%82%E4%B8%96%E7%95%8C%E7%94%9F%E6%B4%BB%E7%AC%AC%E5%9B%9B%E5%AD%A3&amp;total=null&amp;timeAxis=false&amp;sign=f2a8151238a0951457510bd8b37b7314&amp;quarterly=2026%E5%B9%B44%E6%9C%88%E3%80%90%E8%BF%9E%E8%BD%BD%E4%B8%AD%E3%80%91"></iframe>`;

const xml = `<?xml version='1.0' encoding='utf-8'?><i>
  <d p="0,1,22,16707842,0,0,admins,admins">弹幕已装载 (o゜▽゜)o</d>
  <d p="2.7,5,22,16777215,1776476720,0,user,1776476718">终于啊~</d>
  <d p="bad,1,22,16777215,0,0,user,id">bad time</d>
</i>`;

test('ezdmw is accepted by existing source and platform env lists', () => {
  assert.ok(Envs.ALLOWED_SOURCES.includes('ezdmw'));
  assert.ok(Envs.MERGE_ALLOWED_SOURCES.includes('ezdmw'));
  assert.ok(Envs.ALLOWED_PLATFORMS.includes('ezdmw'));
});

test('parses ezdmw search result html into bangumi candidates', () => {
  const source = new EzdmwSource();
  const results = source.parseSearchResults(searchHtml);

  assert.equal(results.length, 2);
  assert.deepEqual(results[0], {
    id: '98626',
    title: 'Re：从零开始的异世界生活第四季',
    detailUrl: 'https://m.ezdmw.site/Index/bangumi/98626.html',
    imageUrl: 'https://www.ezdmw.site/Public/atlas_oss/Public/images/some_img/2530.jpg'
  });
});

test('parses only primary ezdmw episode line and returns ascending episode order', () => {
  const source = new EzdmwSource();
  const detail = source.parseBangumiDetail(bangumiHtml, '98626');

  assert.equal(detail.title, 'Re：从零开始的异世界生活第四季');
  assert.equal(detail.startDate, '2026-04-08');
  assert.equal(detail.typeDescription, 'TV动画');
  assert.deepEqual(detail.episodes.map(ep => ep.name), ['第1集', '第2集', '第3集', '第4集', '第5集']);
  assert.deepEqual(detail.episodes.map(ep => ep.url), [
    'ezdmw://episode/98626',
    'ezdmw://episode/98811',
    'ezdmw://episode/98998',
    'ezdmw://episode/99163',
    'ezdmw://episode/99316'
  ]);
});

test('builds getData url from ezdmw player iframe params', () => {
  const source = new EzdmwSource();
  const params = source.parsePlayerParams(videoHtml);
  const dataUrl = source.buildDanmuDataUrl(params);

  assert.equal(params.nk, 'clksdysjsh4/clksdysjsh4_01');
  assert.equal(params.sign, 'f2a8151238a0951457510bd8b37b7314');
  assert.equal(params.title, 'Re：从零开始的异世界生活第四季');
  assert.equal(
    dataUrl,
    'https://player.ezdmw.com/index/getData.html?video_id=clksdysjsh4%2Fclksdysjsh4_01&json=xml&danmu=clksdysjsh4%2Fclksdysjsh4_01&sign=f2a8151238a0951457510bd8b37b7314&timeAxis=false&getUser=%E6%B8%B8%E5%AE%A2'
  );
});

test('normalizes raw non-ascii player iframe url for safe request headers', () => {
  const source = new EzdmwSource();
  const params = source.parsePlayerParams('<iframe src="https://player.ezdmw.com/danmuku/?nk=a/a_01&sign=abcdefabcdefabcdefabcdefabcdefab&title=Re：从零开始"></iframe>');

  assert.equal(params.nk, 'a/a_01');
  assert.equal(params.title, 'Re：从零开始');
  assert.match(params.playerUrl, /title=Re%EF%BC%9A/);
});

test('formats ezdmw xml comments and drops malformed entries', () => {
  const source = new EzdmwSource();
  const comments = source.formatComments(source.parseXmlComments(xml));

  assert.equal(comments.length, 2);
  assert.deepEqual(comments[0], {
    cid: 'admins',
    p: '0.00,1,16707842,[ezdmw]',
    m: '弹幕已装载 (o゜▽゜)o'
  });
  assert.deepEqual(comments[1], {
    cid: '1776476718',
    p: '2.70,5,16777215,[ezdmw]',
    m: '终于啊~'
  });
});

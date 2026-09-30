import assert from 'node:assert/strict';
// Opt-in live smoke check. Does not print API keys, URLs with queries or response bodies.
import { createOutboundManager } from '../danmu_api/outbound/node-runtime.js';
import { Globals, globals } from '../danmu_api/configs/globals.js';
import { httpGet } from '../danmu_api/utils/http-util.js';
const manager = createOutboundManager();
const protocols = process.argv.slice(2).length ? process.argv.slice(2) : ['h2', 'h3', 'auto'];
try {
  for (const protocol of protocols) {
    const env = { OUTBOUND_MODE: 'auto', OUTBOUND_HTTP_VERSION: protocol, LOG_LEVEL: 'error' };
    Globals.init(env);
    globals.deployPlatform = 'node';
    await manager.configure(env);
    const search = await httpGet('https://api.gamer.com.tw/mobile_app/anime/v1/search.php?kw=' + encodeURIComponent('葬送的芙莉蓮'), { timeout: 15000 });
    const items = search.data?.anime || [];
    const item = items[0];
    console.log(JSON.stringify({ protocol, source: 'bahamut', phase: 'search', status: search.status, count: items.length }));
    const videoSn = item?.video_sn || item?.videoSn || item?.sn;
    if (!videoSn) throw new Error('巴哈姆特搜索未返回可验证的分集标识');
    if (videoSn) {
      const detail = await httpGet('https://api.gamer.com.tw/anime/v1/video.php?videoSn=' + videoSn, { timeout: 15000 });
      const comments = await httpGet('https://api.gamer.com.tw/anime/v1/danmu.php?geo=TW%2CHK&videoSn=' + videoSn, { timeout: 15000 });
      assert.ok(detail.data?.data?.video && detail.data?.data?.anime, '巴哈姆特分集数据无效');
      assert.ok(comments.data?.data?.danmu?.length > 0, '巴哈姆特弹幕为空');
      console.log(JSON.stringify({ protocol, source: 'bahamut', phase: 'episodes', status: detail.status, valid: Boolean(detail.data?.data?.video && detail.data?.data?.anime) }));
      console.log(JSON.stringify({ protocol, source: 'bahamut', phase: 'comments', status: comments.status, count: comments.data?.data?.danmu?.length ?? null }));
    }
    const tmdb = await httpGet('https://api.tmdb.org/3/configuration', { timeout: 15000, validStatusCodes: [401] });
    console.log(JSON.stringify({ protocol, source: 'tmdb', phase: 'certificate-and-response', status: tmdb.status }));
  }
} finally { await manager.stop(); }

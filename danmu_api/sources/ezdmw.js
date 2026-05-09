import BaseSource from './base.js';
import { globals } from '../configs/globals.js';
import { log } from '../utils/log-util.js';
import { httpGet } from '../utils/http-util.js';
import { addAnime, removeEarliestAnime } from '../utils/cache-util.js';
import { simplized } from '../utils/zh-util.js';
import { SegmentListResponse } from '../models/dandan-model.js';

const EZDMW_BASE_URL = 'https://m.ezdmw.site';
const EZDMW_PLAYER_BASE_URL = 'https://player.ezdmw.com';
const EZDMW_UA = 'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36';
const EZDMW_X_REQUESTED_WITH = 'mark.via';

function decodeHtmlEntities(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)));
}

function stripHtml(value = '') {
  return decodeHtmlEntities(String(value)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function getAttr(tag = '', attrName = '') {
  const pattern = new RegExp(`${attrName}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i');
  const match = String(tag).match(pattern);
  return match ? decodeHtmlEntities(match[2]).trim() : '';
}

function getMetaContent(html = '', name = '') {
  const pattern = new RegExp(`<meta\\b(?=[^>]*name=["']${name}["'])([^>]*)>`, 'i');
  const match = String(html).match(pattern);
  return match ? getAttr(match[0], 'content') : '';
}

function absoluteUrl(url = '', base = EZDMW_BASE_URL) {
  const raw = decodeHtmlEntities(String(url || '').trim());
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  return new URL(raw, base).toString();
}

function normalizeEpisodeRef(id = '') {
  const raw = decodeHtmlEntities(String(id || '').trim());
  const match = raw.match(/(?:ezdmw:\/\/episode\/|\/Index\/video\/|^)(\d+)(?:\.html)?$/i);
  return match ? match[1] : raw;
}

function buildEpisodeUrl(id = '') {
  return `ezdmw://episode/${normalizeEpisodeRef(id)}`;
}

function extractYear(value = '') {
  const match = String(value || '').match(/(19\d{2}|20\d{2}|2100)/);
  return match ? match[1] : 'N/A';
}

function parseStartDate(description = '') {
  const text = String(description || '');
  const fullDate = text.match(/(19\d{2}|20\d{2}|2100)年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (fullDate) {
    return `${fullDate[1]}-${String(fullDate[2]).padStart(2, '0')}-${String(fullDate[3]).padStart(2, '0')}`;
  }

  const monthDate = text.match(/(19\d{2}|20\d{2}|2100)年\s*(\d{1,2})月/);
  if (monthDate) {
    return `${monthDate[1]}-${String(monthDate[2]).padStart(2, '0')}-01`;
  }

  const year = extractYear(text);
  return year === 'N/A' ? '' : `${year}-01-01`;
}

function resolveTypeDescription(title = '', description = '') {
  const text = `${title} ${description}`;
  if (/剧场版|劇場版|电影|movie/i.test(text)) return '剧场版';
  if (/OVA|OAD/i.test(text)) return 'OVA';
  return 'TV动画';
}

function cleanTitleFromPageTitle(title = '') {
  return stripHtml(title)
    .replace(/第\s*\d+\s*[集话話].*$/i, '')
    .replace(/在线观看.*$/i, '')
    .replace(/在线免费观看.*$/i, '')
    .replace(/&下载.*$/i, '')
    .replace(/-E站弹幕网.*$/i, '')
    .trim();
}

function normalizeEpisodeName(rawName = '', fallbackIndex = 0) {
  const text = stripHtml(rawName);
  const numberMatch = text.match(/(\d+(?:\.\d+)?)/);
  if (numberMatch) {
    const numeric = Number(numberMatch[1]);
    return Number.isFinite(numeric) ? `第${numeric}集` : `第${numberMatch[1]}集`;
  }
  return text || `第${fallbackIndex + 1}集`;
}

function getEpisodeNumber(name = '') {
  const match = String(name || '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function stableNumericId(value = '') {
  const num = Number.parseInt(String(value || '').replace(/\D/g, ''), 10);
  if (Number.isFinite(num) && num > 0) return num;

  let hash = 0;
  for (const ch of String(value || 'ezdmw')) {
    hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) + 1000000000;
}

export default class EzdmwSource extends BaseSource {
  constructor() {
    super();
    this.BASE_URL = EZDMW_BASE_URL;
    this.PLAYER_BASE_URL = EZDMW_PLAYER_BASE_URL;
    this.detailCache = new Map();
  }

  buildHeaders(referer = this.BASE_URL, accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8') {
    return {
      'User-Agent': EZDMW_UA,
      'Accept': accept,
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Referer': referer,
      'X-Requested-With': EZDMW_X_REQUESTED_WITH,
    };
  }

  async fetchText(url, referer = this.BASE_URL, accept) {
    const response = await httpGet(globals.makeProxyUrl(url), {
      headers: this.buildHeaders(referer, accept),
      timeout: globals.vodRequestTimeout,
      retries: 1,
    });
    return typeof response?.data === 'string' ? response.data : '';
  }

  parseSearchResults(html = '') {
    const results = [];
    const seen = new Set();
    const blockRegex = /<div\b[^>]*>\s*<a\b([^>]*)href=["']([^"']*\/Index\/bangumi\/(\d+)\.html)["']([^>]*)>([\s\S]*?)<\/a>\s*<p\b[^>]*>([\s\S]*?)<\/p>\s*<\/div>/gi;

    for (const match of String(html).matchAll(blockRegex)) {
      const id = match[3];
      if (!id || seen.has(id)) continue;

      const anchorHtml = match[5] || '';
      const pHtml = String(match[6] || '').replace(/<span\b[\s\S]*?<\/span>/gi, ' ');
      const title = stripHtml(pHtml);
      if (!title) continue;

      const imageMatch = anchorHtml.match(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/i);
      const imageUrl = imageMatch ? absoluteUrl(imageMatch[1], this.BASE_URL) : '';

      seen.add(id);
      results.push({
        id,
        title,
        detailUrl: absoluteUrl(match[2], this.BASE_URL),
        imageUrl,
      });
    }

    return results;
  }

  parseBangumiDetail(html = '', id = '') {
    const keywordsTitle = getMetaContent(html, 'keywords');
    const titleTag = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
    const title = keywordsTitle || cleanTitleFromPageTitle(titleTag);
    const description = getMetaContent(html, 'description');
    const startDate = parseStartDate(description);
    const typeDescription = resolveTypeDescription(title, description);
    const episodes = [];
    const seen = new Set();
    const anchors = [];
    const anchorRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

    for (const match of String(html).matchAll(anchorRegex)) {
      const attrs = match[1] || '';
      const href = getAttr(attrs, 'href');
      const videoMatch = href.match(/\/Index\/video\/(\d+)\.html/i);
      if (!videoMatch) continue;

      anchors.push({
        href,
        episodeId: videoMatch[1],
        className: getAttr(attrs, 'class'),
        text: stripHtml(match[2]),
      });
    }

    let selected = anchors.filter(item => /\bcircuit_switch1\b/.test(item.className));
    if (selected.length === 0) selected = anchors;

    for (const item of selected) {
      if (seen.has(item.episodeId)) continue;
      seen.add(item.episodeId);
      episodes.push({
        id: item.episodeId,
        name: normalizeEpisodeName(item.text, episodes.length),
        url: buildEpisodeUrl(item.episodeId),
      });
    }

    if (episodes.length > 1) {
      const first = getEpisodeNumber(episodes[0].name);
      const last = getEpisodeNumber(episodes[episodes.length - 1].name);
      if (Number.isFinite(first) && Number.isFinite(last) && first > last) {
        episodes.reverse();
      }
    }

    return {
      id: String(id || ''),
      title,
      description,
      startDate,
      typeDescription,
      year: extractYear(startDate || description),
      episodes,
    };
  }

  parsePlayerParams(html = '') {
    const iframeMatch = String(html).match(/(?:src|href)=["']([^"']*player\.ezdmw\.com\/danmuku\/[^"']+)["']/i)
      || String(html).match(/(https?:)?\/\/player\.ezdmw\.com\/danmuku\/[^"'<>\\\s]+/i);

    if (!iframeMatch) return null;

    const playerUrl = absoluteUrl(iframeMatch[1], this.PLAYER_BASE_URL);
    const parsed = new URL(playerUrl);
    const params = parsed.searchParams;
    const nk = params.get('nk') || params.get('video_id') || '';
    const sign = params.get('sign') || '';
    if (!nk || !sign) return null;

    return {
      playerUrl: parsed.toString(),
      nk,
      sign,
      title: params.get('title') || '',
      quarterly: params.get('quarterly') || '',
      timeAxis: params.get('timeAxis') || 'false',
    };
  }

  buildDanmuDataUrl(params) {
    if (!params?.nk || !params?.sign) return '';
    const url = new URL('/index/getData.html', this.PLAYER_BASE_URL);
    url.searchParams.set('video_id', params.nk);
    url.searchParams.set('json', 'xml');
    url.searchParams.set('danmu', params.nk);
    url.searchParams.set('sign', params.sign);
    url.searchParams.set('timeAxis', params.timeAxis || 'false');
    url.searchParams.set('getUser', '游客');
    return url.toString();
  }

  parseXmlComments(xml = '') {
    const comments = [];
    const regex = /<d\b[^>]*\sp=(["'])([\s\S]*?)\1[^>]*>([\s\S]*?)<\/d>/gi;
    for (const match of String(xml).matchAll(regex)) {
      comments.push({
        p: decodeHtmlEntities(match[2]),
        m: decodeHtmlEntities(match[3].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim(),
      });
    }
    return comments;
  }

  async search(keyword) {
    const query = String(keyword || '').trim();
    if (!query) return [];

    try {
      const url = new URL('/Index/search.html', this.BASE_URL);
      url.searchParams.set('searchText', query);
      const html = await this.fetchText(url.toString(), this.BASE_URL);
      const results = this.parseSearchResults(html);
      log('info', `[Ezdmw] 搜索找到 ${results.length} 个有效结果`);
      return results;
    } catch (error) {
      log('warn', `[Ezdmw] 搜索失败: ${error.message}`);
      return [];
    }
  }

  async getBangumiDetail(id) {
    const bangumiId = String(id || '').trim();
    if (!bangumiId) return this.parseBangumiDetail('', '');
    if (this.detailCache.has(bangumiId)) return this.detailCache.get(bangumiId);

    const task = (async () => {
      try {
        const url = new URL(`/Index/bangumi/${bangumiId}.html`, this.BASE_URL).toString();
        const html = await this.fetchText(url, this.BASE_URL);
        return this.parseBangumiDetail(html, bangumiId);
      } catch (error) {
        log('warn', `[Ezdmw] 获取详情失败 ${bangumiId}: ${error.message}`);
        return this.parseBangumiDetail('', bangumiId);
      }
    })();

    this.detailCache.set(bangumiId, task);
    return task;
  }

  async getEpisodes(id) {
    const detail = await this.getBangumiDetail(id);
    return detail.episodes || [];
  }

  async handleAnimes(sourceAnimes, queryTitle, curAnimes, detailStore = null) {
    const tmpAnimes = [];
    if (!Array.isArray(sourceAnimes) || sourceAnimes.length === 0) return [];

    const tasks = sourceAnimes.map(async (anime) => {
      try {
        const id = String(anime?.id || anime?.bangumiId || '').trim();
        if (!id) return;

        const detail = await this.getBangumiDetail(id);
        const links = (detail.episodes || []).map((ep, index) => {
          const name = ep.name || `第${index + 1}集`;
          return {
            name,
            url: ep.url,
            title: `【ezdmw】 ${name}`,
          };
        });

        if (links.length === 0) return;

        const title = detail.title || anime.title || queryTitle || `ezdmw-${id}`;
        const year = detail.year && detail.year !== 'N/A' ? detail.year : extractYear(detail.startDate || detail.description || title);
        const typeDescription = detail.typeDescription || 'TV动画';
        const transformedAnime = {
          animeId: stableNumericId(id),
          bangumiId: id,
          animeTitle: `${title}(${year || 'N/A'})【${typeDescription}】from ezdmw`,
          type: typeDescription,
          typeDescription,
          imageUrl: anime.imageUrl || '',
          startDate: detail.startDate || (year && year !== 'N/A' ? `${year}-01-01` : ''),
          episodeCount: links.length,
          rating: 0,
          isFavorited: true,
          source: 'ezdmw',
        };

        tmpAnimes.push(transformedAnime);
        addAnime({ ...transformedAnime, links }, detailStore);
        if (globals.animes.length > globals.MAX_ANIMES) removeEarliestAnime();
      } catch (error) {
        log('warn', `[Ezdmw] 处理搜索结果失败: ${error.message}`);
      }
    });

    const processed = await Promise.all(tasks);
    this.sortAndPushAnimesByYear(tmpAnimes, curAnimes);
    return processed;
  }

  async getEpisodeDanmu(id) {
    const episodeId = normalizeEpisodeRef(id);
    if (!episodeId) return [];

    try {
      const videoUrl = new URL(`/Index/video/${episodeId}.html`, this.BASE_URL).toString();
      const videoHtml = await this.fetchText(videoUrl, this.BASE_URL);
      const params = this.parsePlayerParams(videoHtml);
      if (!params) {
        log('warn', `[Ezdmw] 未解析到播放器参数: ${episodeId}`);
        return [];
      }

      const danmuUrl = this.buildDanmuDataUrl(params);
      const xml = await this.fetchText(danmuUrl, params.playerUrl, 'text/xml,application/xml,*/*;q=0.8');
      const comments = this.parseXmlComments(xml);
      log('info', `[Ezdmw] 获取原始弹幕 ${comments.length} 条: ${episodeId}`);
      return comments;
    } catch (error) {
      log('warn', `[Ezdmw] 获取弹幕失败 ${episodeId}: ${error.message}`);
      return [];
    }
  }

  async getEpisodeDanmuSegments(id) {
    return new SegmentListResponse({
      type: 'ezdmw',
      segmentList: [{
        type: 'ezdmw',
        segment_start: 0,
        segment_end: 30000,
        url: id,
      }]
    });
  }

  async getEpisodeSegmentDanmu(segment) {
    return this.getEpisodeDanmu(segment.url);
  }

  formatComments(comments) {
    if (!Array.isArray(comments)) return [];

    return comments.map((comment, index) => {
      const pValues = String(comment?.p || '').split(',');
      const time = Number.parseFloat(pValues[0]);
      if (!Number.isFinite(time)) return null;

      const mode = Number.parseInt(pValues[1] || '1', 10) || 1;
      const color = Number.parseInt(pValues.length >= 4 ? pValues[3] : pValues[2], 10);
      const cid = pValues[7] || pValues[6] || String(index + 1);
      const text = String(comment?.m || '').trim();
      if (!text) return null;

      return {
        cid,
        p: `${time.toFixed(2)},${mode},${Number.isFinite(color) ? color : 16777215},[ezdmw]`,
        m: globals.danmuSimplifiedTraditional === 'simplified' ? simplized(text) : text,
      };
    }).filter(Boolean);
  }
}

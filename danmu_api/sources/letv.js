import BaseSource from './base.js';
import { globals } from '../configs/globals.js';
import { log } from "../utils/log-util.js";
import { httpGet } from "../utils/http-util.js";
import { convertToAsciiSum } from "../utils/codec-util.js";
import { generateValidStartDate } from "../utils/time-util.js";
import { addAnime, removeEarliestAnime } from "../utils/cache-util.js";
import { titleMatches } from "../utils/common-util.js";

// =====================
// 获取乐视视频弹幕
// =====================
export default class LetvSource extends BaseSource {
  constructor() {
    super();
    this.danmuApiUrl = "https://hd-my.le.com/danmu/list";
    this.searchApiUrl = "https://so.le.com/s";
  }

  /**
   * 过滤乐视视频搜索项
   */
  filterLetvSearchItem(dataInfo, htmlBlock) {
    try {
      const pid = dataInfo.pid || '';
      const mediaTypeStr = dataInfo.type || '';
      const total = dataInfo.total || '0';

      if (!pid) return null;

      // 提取标题
      let title = '';
      const titleMatch = htmlBlock.match(/<h1>.*?title="([^"]+)"/s);
      if (titleMatch) {
        title = titleMatch[1];
      } else {
        const aTitleMatch = htmlBlock.match(/<a[^>]*title="([^"]+)"[^>]*class="j-baidu-a"/);
        if (aTitleMatch) {
          title = aTitleMatch[1];
        }
      }

      if (!title) return null;

      // 提取海报
      const imgMatch = htmlBlock.match(/<img[^>]*(?:src|data-src|alt)="([^"]+)"/);
      let imageUrl = imgMatch ? imgMatch[1] : '';

      // 提取年份
      let year = null;
      let yearMatch = htmlBlock.match(/<b>年份：<\/b>.*?>(\d{4})<\/a>/);
      if (!yearMatch) yearMatch = htmlBlock.match(/<b>上映时间：<\/b>.*?>(\d{4})<\/a>/);
      if (!yearMatch) yearMatch = htmlBlock.match(/_y(\d{4})_/);
      if (!yearMatch) yearMatch = (dataInfo.keyWord || '').match(/(\d{4})/);
      if (yearMatch) year = parseInt(yearMatch[1]);

      // 映射媒体类型
      const typeMap = {
        'tv': '电视剧',
        'movie': '电影',
        'cartoon': '动漫',
        'comic': '动漫'
      };
      const resultType = typeMap[mediaTypeStr] || '电视剧';

      // 解析集数
      const episodeCount = (total && /^\d+$/.test(total)) ? parseInt(total) : 0;

      // 验证分集数据完整性
      const vidEpisode = dataInfo.vidEpisode || '';
      if (episodeCount > 0 && vidEpisode) {
        const actualCount = vidEpisode.split(',').length;
        if (actualCount !== episodeCount) {
          log("warn", `[Letv] 跳过 '${title}' - 集数不匹配: ${actualCount}/${episodeCount}`);
          return null;
        }
      }

      // 确保图片URL是完整的
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = imageUrl.startsWith('//') ? `https:${imageUrl}` : `https://${imageUrl}`;
      }

      return {
        provider: "letv",
        mediaId: pid,
        title: title,
        type: resultType,
        year: year || 0,
        imageUrl: imageUrl || "",
        episodeCount: episodeCount,
        vidEpisode: vidEpisode
      };

    } catch (error) {
      log("warn", `[Letv] 过滤搜索项失败: ${error.message}`);
      return null;
    }
  }

  async search(keyword) {
    try {
      log("info", `[Letv] 开始搜索: ${keyword}`);

      const params = new URLSearchParams({
        'wd': keyword,
        'from': 'pc',
        'ref': 'click',
        'click_area': 'search_button',
        'query': keyword,
        'is_default_query': '0',
        'module': 'search_rst_page'
      });

      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://so.le.com/'
      };

      const response = await httpGet(`${this.searchApiUrl}?${params}`, { headers });

      if (!response || !response.data) {
        log("info", "[Letv] 搜索响应为空");
        return [];
      }

      const htmlContent = typeof response.data === "string" ? response.data : String(response.data);
      const pattern = /<div class="So-detail[^"]*"[^>]*data-info="({.*?})"[^>]*>/gs;
      const matches = [...htmlContent.matchAll(pattern)];

      const results = [];
      for (const match of matches) {
        try {
          let dataInfoStr = match[1];
          dataInfoStr = dataInfoStr.replace(/'/g, '"').replace(/([{,])(\w+):/g, '$1"$2":');
          const dataInfo = JSON.parse(dataInfoStr);

          const startPos = match.index;
          const endPatterns = ['</div>\n\t</div>', '</div>\n</div>', '</div></div>'];
          let endPos = -1;

          for (const endPattern of endPatterns) {
            const pos = htmlContent.indexOf(endPattern, startPos);
            if (pos !== -1) {
              endPos = pos;
              break;
            }
          }

          if (endPos === -1) {
            const nextMatch = htmlContent.indexOf('<div class="So-detail', startPos + 100);
            if (nextMatch !== -1) endPos = nextMatch;
            else continue;
          }

          const htmlBlock = htmlContent.substring(startPos, endPos);
          const filtered = this.filterLetvSearchItem(dataInfo, htmlBlock);
          if (filtered) results.push(filtered);

        } catch (error) {
          log("warn", `[Letv] 解析搜索项失败: ${error.message}`);
          continue;
        }
      }

      log("info", `[Letv] 搜索找到 ${results.length} 个结果`);
      return results;

    } catch (error) {
      log("error", `[Letv] 搜索出错: ${error.message}`);
      return [];
    }
  }

  async getEpisodes(mediaId) {
    try {
      log("info", `[Letv] 获取分集列表: pid=${mediaId}`);

      const urlsToTry = [
        `https://www.le.com/tv/${mediaId}.html`,
        `https://www.le.com/comic/${mediaId}.html`,
        `https://www.le.com/playlet/${mediaId}.html`,
        `https://www.le.com/movie/${mediaId}.html`
      ];

      let htmlContent = null;
      for (const url of urlsToTry) {
        try {
          const response = await httpGet(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 10000
          });

          if (response && response.data) {
            htmlContent = typeof response.data === 'string' ? response.data : String(response.data);
            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (!htmlContent) {
        log("error", `[Letv] 无法获取作品页面: pid=${mediaId}`);
        return [];
      }

      const dataInfoMatch = htmlContent.match(/data-info="({.*?})"/s);
      if (!dataInfoMatch) {
        log("error", `[Letv] HTML中未找到data-info`);
        return [];
      }

      let dataInfoStr = dataInfoMatch[1];
      dataInfoStr = dataInfoStr.replace(/'/g, '"').replace(/([{,])(\w+):/g, '$1"$2":');
      const dataInfo = JSON.parse(dataInfoStr);
      const vidEpisodeStr = dataInfo.vidEpisode || '';

      if (!vidEpisodeStr) {
        log("warn", `[Letv] 未找到分集信息`);
        return [];
      }

      // 解析vidEpisode: '1-26316591,2-26316374,...'
      const episodes = [];
      for (const item of vidEpisodeStr.split(',')) {
        const parts = item.split('-');
        if (parts.length !== 2) continue;

        const episodeIndex = parseInt(parts[0]);
        const videoId = parts[1];

        episodes.push({
          vid: videoId,
          title: `第${episodeIndex}集`,
          episodeIndex: episodeIndex,
          url: `https://www.le.com/ptv/vplay/${videoId}.html`
        });
      }

      log("info", `[Letv] 成功获取 ${episodes.length} 个分集`);
      return episodes;

    } catch (error) {
      log("error", `[Letv] 获取分集出错: ${error.message}`);
      return [];
    }
  }

  async handleAnimes(sourceAnimes, queryTitle, curAnimes) {
    const tmpAnimes = [];

    if (!sourceAnimes || !Array.isArray(sourceAnimes)) {
      log("error", "[Letv] sourceAnimes is not a valid array");
      return [];
    }

    const processLetvAnimes = await Promise.all(sourceAnimes
      .filter(s => titleMatches(s.title, queryTitle))
      .map(async (anime) => {
        try {
          const eps = await this.getEpisodes(anime.mediaId);
          const links = [];
          const numericAnimeId = convertToAsciiSum(anime.mediaId);

          for (let i = 0; i < eps.length; i++) {
            const ep = eps[i];
            const episodeNumericId = numericAnimeId * 1000000 + (i + 1);

            links.push({
              "name": (i + 1).toString(),
              "url": ep.url,
              "title": `【letv】 ${ep.title}`,
              "id": episodeNumericId
            });
          }

          if (links.length > 0) {
            const transformedAnime = {
              animeId: numericAnimeId,
              bangumiId: anime.mediaId,
              animeTitle: `${anime.title}(${anime.year || 'N/A'})【${anime.type}】from letv`,
              type: anime.type,
              typeDescription: anime.type,
              imageUrl: anime.imageUrl,
              startDate: generateValidStartDate(anime.year),
              episodeCount: links.length,
              rating: 0,
              isFavorited: true,
              source: "letv",
            };

            tmpAnimes.push(transformedAnime);
            addAnime({...transformedAnime, links: links});

            if (globals.animes.length > globals.MAX_ANIMES) removeEarliestAnime();
          }
        } catch (error) {
          log("error", `[Letv] Error processing anime: ${error.message}`);
        }
      })
    );

    this.sortAndPushAnimesByYear(tmpAnimes, curAnimes);
    return processLetvAnimes;
  }

  async getEpisodeDanmu(url) {
    log("info", "[Letv] 开始获取弹幕...", url);

    try {
      let vid;

      // 处理完整 URL
      if (url.includes('le.com')) {
        const vidMatch = url.match(/\/vplay\/(\d+)\.html/);
        if (vidMatch) {
          vid = vidMatch[1];
        } else {
          log("error", "[Letv] 无法从URL中提取vid");
          return [];
        }
      } else {
        // 处理数字 episodeId
        const episodeId = parseInt(url);
        let foundLink = null;

        for (const anime of globals.animes) {
          if (anime.links) {
            foundLink = anime.links.find(link => link.id === episodeId);
            if (foundLink) {
              return await this.getEpisodeDanmu(foundLink.url);
            }
          }
        }

        if (!foundLink) {
          log("error", `[Letv] 未找到 episodeId ${episodeId}`);
          return [];
        }
      }

      // 获取视频时长
      const duration = await this._getVideoDuration(vid);
      
      // 并发获取弹幕
      const segmentDuration = 300;
      const totalSegments = Math.ceil(duration / segmentDuration);
      const allDanmu = [];
      const concurrency = 6;

      for (let batchStart = 0; batchStart < totalSegments; batchStart += concurrency) {
        const promises = [];

        for (let i = 0; i < concurrency; i++) {
          const currentIndex = batchStart + i;
          if (currentIndex >= totalSegments) break;

          const startTime = currentIndex * segmentDuration;
          const endTime = Math.min((currentIndex + 1) * segmentDuration, duration);

          promises.push(
            this._getDanmuSegment(vid, startTime, endTime)
              .catch(() => [])
          );
        }

        const batchResults = await Promise.all(promises);
        for (const items of batchResults) {
          if (items.length > 0) allDanmu.push(...items);
        }
      }

      if (allDanmu.length === 0) {
        log("info", "[Letv] 该视频暂无弹幕");
        return [];
      }

      // 按时间排序
      allDanmu.sort((a, b) => parseFloat(a.start || 0) - parseFloat(b.start || 0));

      log("info", `[Letv] 共获取 ${allDanmu.length} 条弹幕`);
      return allDanmu;

    } catch (error) {
      log("error", `[Letv] 获取弹幕出错: ${error.message}`);
      return [];
    }
  }

  async _getDanmuSegment(vid, startTime, endTime) {
    try {
      const params = new URLSearchParams({
        'vid': vid,
        'start': startTime.toString(),
        'end': endTime.toString(),
        'callback': `vjs_${Date.now()}`
      });

      const response = await httpGet(`${this.danmuApiUrl}?${params}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.le.com/'
        },
        timeout: 10000
      });

      if (!response || !response.data) return [];

      const text = typeof response.data === 'string' ? response.data : String(response.data);
      const jsonMatch = text.match(/vjs_\d+\((.*)\)/);
      if (!jsonMatch) return [];

      const data = JSON.parse(jsonMatch[1]);
      if (data.code === 200 && data.data) {
        return data.data.list || [];
      }

      return [];

    } catch (error) {
      return [];
    }
  }

  async _getVideoDuration(videoId) {
    try {
      const response = await httpGet(`https://www.le.com/ptv/vplay/${videoId}.html`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 10000
      });

      if (!response || !response.data) return 2400;

      const text = typeof response.data === 'string' ? response.data : String(response.data);
      const durationMatch = text.match(/duration['\"]?\s*:\s*['\"]?(\d+):(\d+)['\"]?/);
      
      if (durationMatch) {
        return parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2]);
      }

      return 2400;

    } catch (error) {
      return 2400;
    }
  }

  formatComments(comments) {
    if (!comments || !Array.isArray(comments)) return [];

    const positionMap = { 1: 1, 4: 5, 5: 4 };
    const formatted = [];

    for (const item of comments) {
      try {
        let text = item.txt || item.content || '';
        text = String(text).trim();
        if (!text) continue;

        // 解析颜色
        let color = 16777215;
        if (item.color) {
          const colorStr = String(item.color);
          color = colorStr.startsWith('#') 
            ? parseInt(colorStr.substring(1), 16) 
            : parseInt(colorStr, 16);
        }

        formatted.push({
          timepoint: parseFloat(item.start || 0),
          ct: positionMap[parseInt(item.position || 4)] || 1,
          size: 25,
          color: color,
          unixtime: parseInt(item.addtime || 0) || Math.floor(Date.now() / 1000),
          uid: String(item.uid || '0'),
          content: text
        });

      } catch (error) {
        continue;
      }
    }

    return formatted;
  }
}
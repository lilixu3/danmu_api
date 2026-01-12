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

      if (!pid) {
        return null;
      }

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

      if (!title) {
        return null;
      }

      // 提取海报
      const imgMatch = htmlBlock.match(/<img[^>]*(?:src|data-src|alt)="([^"]+)"/);
      let imageUrl = imgMatch ? imgMatch[1] : '';

      // 提取年份
      let year = null;
      let yearMatch = htmlBlock.match(/<b>年份：<\/b>.*?>(\d{4})<\/a>/);
      if (!yearMatch) {
        yearMatch = htmlBlock.match(/<b>上映时间：<\/b>.*?>(\d{4})<\/a>/);
      }
      if (!yearMatch) {
        yearMatch = htmlBlock.match(/_y(\d{4})_/);
      }
      if (!yearMatch) {
        yearMatch = (dataInfo.keyWord || '').match(/(\d{4})/);
      }
      if (yearMatch) {
        year = parseInt(yearMatch[1]);
      }

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
      if (episodeCount > 0) {
        if (!vidEpisode) {
          log("warn", `[Letv] 跳过结果 '${title}' (pid=${pid})，原因：声称有${episodeCount}集，但vidEpisode为空`);
          return null;
        }

        const vidEpisodeParts = vidEpisode.split(',');
        const actualEpisodeCount = vidEpisodeParts.length;

        if (actualEpisodeCount !== episodeCount) {
          log("warn", `[Letv] 跳过结果 '${title}' (pid=${pid})，原因：声称有${episodeCount}集，但vidEpisode只有${actualEpisodeCount}集`);
          return null;
        }

        log("debug", `[Letv] 验证通过 '${title}' (pid=${pid})，vidEpisode集数=${actualEpisodeCount}，total=${episodeCount}`);
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://so.le.com/',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin'
      };

      const response = await httpGet(`${this.searchApiUrl}?${params.toString()}`, { headers });

      if (!response || !response.data) {
        log("info", "[Letv] 搜索响应为空");
        return [];
      }

      const htmlContent = typeof response.data === "string" ? response.data : String(response.data);
      log("debug", `[Letv] 搜索请求成功，响应长度: ${htmlContent.length} 字符`);

      const pattern = /<div class="So-detail[^"]*"[^>]*data-info="({.*?})"[^>]*>/gs;
      const matches = [...htmlContent.matchAll(pattern)];

      log("debug", `[Letv] 从HTML中找到 ${matches.length} 个 data-info 块`);

      const results = [];
      for (const match of matches) {
        try {
          let dataInfoStr = match[1];
          log("debug", `[Letv] 提取到 data-info 原始字符串: ${dataInfoStr.substring(0, 200)}...`);

          dataInfoStr = dataInfoStr.replace(/'/g, '"');
          dataInfoStr = dataInfoStr.replace(/([{,])(\w+):/g, '$1"$2":');

          const dataInfo = JSON.parse(dataInfoStr);
          log("debug", `[Letv] 成功解析 data-info，pid=${dataInfo.pid}, type=${dataInfo.type}`);

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
            if (nextMatch !== -1) {
              endPos = nextMatch;
            } else {
              continue;
            }
          }

          const htmlBlock = htmlContent.substring(startPos, endPos);

          const filtered = this.filterLetvSearchItem(dataInfo, htmlBlock);
          if (filtered) {
            results.push(filtered);
          }

        } catch (error) {
          log("warn", `[Letv] 解析搜索结果项失败: ${error.message}`);
          continue;
        }
      }

      if (results.length > 0) {
        log("info", `[Letv] 搜索找到 ${results.length} 个有效结果`);
        results.forEach(r => {
          log("info", `  - ${r.title} (ID: ${r.mediaId}, 类型: ${r.type}, 年份: ${r.year})`);
        });
      } else {
        log("info", `[Letv] 搜索 '${keyword}' 未找到结果`);
      }

      return results;

    } catch (error) {
      log("error", `[Letv] 搜索出错: ${error.message}`);
      return [];
    }
  }

  async getEpisodes(mediaId) {
    try {
      log("info", `[Letv] 获取分集列表: pid=${mediaId}`);

      // 构造作品页面URL
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
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
              'Upgrade-Insecure-Requests': '1',
              'Sec-Fetch-Dest': 'document',
              'Sec-Fetch-Mode': 'navigate',
              'Sec-Fetch-Site': 'same-origin'
            },
            timeout: 10000
          });

          if (response && response.data) {
            htmlContent = typeof response.data === 'string' ? response.data : String(response.data);
            log("debug", `[Letv] 成功获取页面: ${url}`);
            break;
          }
        } catch (error) {
          log("debug", `[Letv] 尝试URL失败 ${url}: ${error.message}`);
          continue;
        }
      }

      if (!htmlContent) {
        log("error", `[Letv] 无法获取作品页面: pid=${mediaId}`);
        return [];
      }

      // 从HTML中提取data-info
      const dataInfoMatch = htmlContent.match(/data-info="({.*?})"/s);
      if (!dataInfoMatch) {
        log("error", `[Letv] HTML中未找到data-info: pid=${mediaId}`);
        return [];
      }

      let dataInfoStr = dataInfoMatch[1];
      dataInfoStr = dataInfoStr.replace(/'/g, '"');
      dataInfoStr = dataInfoStr.replace(/([{,])(\w+):/g, '$1"$2":');

      const dataInfo = JSON.parse(dataInfoStr);
      const vidEpisodeStr = dataInfo.vidEpisode || '';

      if (!vidEpisodeStr) {
        log("warn", `[Letv] 未找到分集信息: pid=${mediaId}`);
        return [];
      }

      // 解析vidEpisode: '1-26316591,2-26316374,3-26327049,...'
      const episodes = [];
      for (const item of vidEpisodeStr.split(',')) {
        try {
          const parts = item.split('-');
          if (parts.length !== 2) {
            continue;
          }

          const episodeIndex = parseInt(parts[0]);
          const videoId = parts[1];

          episodes.push({
            vid: videoId,
            title: `第${episodeIndex}集`,
            episodeIndex: episodeIndex,
            url: `https://www.le.com/ptv/vplay/${videoId}.html`
          });

        } catch (error) {
          log("warn", `[Letv] 解析分集失败: ${item}, 错误: ${error.message}`);
          continue;
        }
      }

      log("info", `[Letv] 成功获取 ${episodes.length} 个分集 (pid=${mediaId})`);
      return episodes;

    } catch (error) {
      log("error", `[Letv] 获取分集列表出错: ${error.message}`);
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
          let links = [];

          const numericAnimeId = convertToAsciiSum(anime.mediaId);

          for (let i = 0; i < eps.length; i++) {
            const ep = eps[i];
            const epTitle = ep.title || `第${i + 1}集`;
            const fullUrl = ep.url || `https://www.le.com/ptv/vplay/${ep.vid}.html`;

            const episodeNumericId = numericAnimeId * 1000000 + (i + 1);

            links.push({
              "name": (i + 1).toString(),
              "url": fullUrl,
              "title": `【letv】 ${epTitle}`,
              "id": episodeNumericId
            });
          }

          if (links.length > 0) {
            let transformedAnime = {
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
    log("info", "[Letv] 开始从本地请求乐视视频弹幕...", url);

    try {
      let vid;

      // 1. 处理完整 URL
      if (url.includes('le.com')) {
        const vidMatch = url.match(/\/vplay\/(\d+)\.html/);
        if (vidMatch) {
          vid = vidMatch[1];
          log("info", `[Letv] 从URL提取到 vid=${vid}`);
        } else {
          log("error", "[Letv] 无法从URL中提取vid");
          return [];
        }
      } else {
        // 2. 处理数字 episodeId
        const episodeId = parseInt(url);
        let foundLink = null;

        for (const anime of globals.animes) {
          if (anime.links) {
            foundLink = anime.links.find(link => link.id === episodeId);
            if (foundLink) {
              log("info", `[Letv] 找到 episodeId ${episodeId} 对应的URL: ${foundLink.url}`);
              return await this.getEpisodeDanmu(foundLink.url);
            }
          }
        }

        if (!foundLink) {
          log("error", `[Letv] 未找到 episodeId ${episodeId} 对应的URL`);
          return [];
        }
      }

      // 获取视频时长（默认2400秒=40分钟）
      const duration = await this._getVideoDuration(vid);
      log("info", `[Letv] 视频时长: ${duration}秒`);

      // 计算需要请求的时间段（每段5分钟=300秒）
      const segmentDuration = 300;
      const totalSegments = Math.ceil(duration / segmentDuration);
      const allDanmu = [];
      const concurrency = 6;

      log("info", `[Letv] 开始并发获取弹幕 (共${totalSegments}个时间段, 并发数: ${concurrency})`);

      // 分批并发请求
      for (let batchStart = 0; batchStart < totalSegments; batchStart += concurrency) {
        const promises = [];

        for (let i = 0; i < concurrency; i++) {
          const currentIndex = batchStart + i;
          if (currentIndex >= totalSegments) break;

          const startTime = currentIndex * segmentDuration;
          const endTime = Math.min((currentIndex + 1) * segmentDuration, duration);

          const p = this._getDanmuSegment(vid, startTime, endTime)
            .then(items => ({ start: startTime, items: items || [] }))
            .catch(err => {
              log("warn", `[Letv] 获取片段 ${startTime}s 失败: ${err.message}`);
              return { start: startTime, items: [] };
            });

          promises.push(p);
        }

        const batchResults = await Promise.all(promises);

        for (const result of batchResults) {
          if (result.items.length > 0) {
            allDanmu.push(...result.items);
          }
        }

        if (allDanmu.length > 0 && batchStart % 6 === 0) {
          log("info", `[Letv] 已扫描至 ${Math.min((batchStart + concurrency) * segmentDuration, duration) / 60} 分钟, 累计弹幕: ${allDanmu.length}`);
        }
      }

      if (allDanmu.length === 0) {
        log("info", "[Letv] 该视频暂无弹幕数据");
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

      const url = `${this.danmuApiUrl}?${params.toString()}`;

      const response = await httpGet(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.le.com/'
        },
        timeout: 10000
      });

      if (!response || !response.data) {
        return [];
      }

      let text = typeof response.data === 'string' ? response.data : String(response.data);

      const jsonMatch = text.match(/vjs_\d+\((.*)\)/);
      if (!jsonMatch) {
        return [];
      }

      const data = JSON.parse(jsonMatch[1]);
      if (data.code === 200 && data.data) {
        const comments = data.data.list || [];
        log("debug", `[Letv] 获取时间段 ${startTime}-${endTime}s 的弹幕: ${comments.length} 条`);
        return comments;
      }

      return [];

    } catch (error) {
      log("warn", `[Letv] 获取时间段 ${startTime}-${endTime}s 弹幕失败: ${error.message}`);
      return [];
    }
  }

  async _getVideoDuration(videoId) {
    try {
      const url = `https://www.le.com/ptv/vplay/${videoId}.html`;
      const response = await httpGet(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      if (!response || !response.data) {
        log("warn", "[Letv] 无法获取视频页面，使用默认时长2400秒");
        return 2400;
      }

      const text = typeof response.data === 'string' ? response.data : String(response.data);

      const durationMatch = text.match(/duration['\"]?\s*:\s*['\"]?(\d+):(\d+)['\"]?/);
      if (durationMatch) {
        const minutes = parseInt(durationMatch[1]);
        const seconds = parseInt(durationMatch[2]);
        return minutes * 60 + seconds;
      }

      log("warn", "[Letv] 未找到视频时长信息，使用默认值2400秒");
      return 2400;

    } catch (error) {
      log("warn", `[Letv] 获取视频时长失败: ${error.message}，使用默认值2400秒`);
      return 2400;
    }
  }

  formatComments(comments) {
    if (!comments || !Array.isArray(comments)) {
      log("warn", "[Letv] formatComments 接收到无效的 comments 参数");
      return [];
    }

    const formatted = [];
    const positionMap = { 1: 1, 4: 5, 5: 4 };

    for (const item of comments) {
      try {
        let text = item.txt || item.content || '';
        if (typeof text !== 'string') {
          text = String(text);
        }

        text = text.trim();
        if (!text || text === '' || text === 'null' || text === 'undefined') {
          continue;
        }

        const timepoint = parseFloat(item.start || 0);

        let color = 16777215;
        if (item.color) {
          const colorValue = item.color;
          if (typeof colorValue === 'string' && colorValue.startsWith('#')) {
            color = parseInt(colorValue.substring(1), 16);
          } else {
            color = parseInt(String(colorValue), 16);
          }
        }

        let unixtime = parseInt(item.addtime || 0);
        if (unixtime === 0) {
          unixtime = Math.floor(Date.now() / 1000);
        }

        const uid = String(item.uid || '0');
        const position = parseInt(item.position || 4);
        const ct = positionMap[position] || 1;

        const danmuObj = {
          timepoint: timepoint,
          ct: ct,
          size: 25,
          color: color,
          unixtime: unixtime,
          uid: uid,
          content: text
        };

        formatted.push(danmuObj);

      } catch (error) {
        log("debug", `[Letv] 格式化单条弹幕出错: ${error.message}`);
      }
    }

    log("info", `[Letv] 成功格式化 ${formatted.length} 条弹幕`);
    return formatted;
  }
}
import { globals } from '../configs/globals.js';
import { log } from './log-util.js'
import {httpGet, httpPost} from "./http-util.js";

// ---------------------
// 豆瓣 API 工具方法
// ---------------------

const DOUBAN_MOBILE_REFERER = "https://m.douban.com/movie/";
const DOUBAN_SEARCH_REFERER = "https://m.douban.com/search/?query=";
const DOUBAN_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

function getDoubanCookie() {
  if (typeof globals?.doubanCookie === 'string') {
    return globals.doubanCookie.trim();
  }
  return '';
}

function buildDoubanHeaders({ keyword = '', referer = DOUBAN_MOBILE_REFERER, includeCookie = true } = {}) {
  const headers = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Content-Type": "application/json",
    "Referer": keyword ? `${DOUBAN_SEARCH_REFERER}${encodeURIComponent(keyword)}` : referer,
    "User-Agent": DOUBAN_USER_AGENT,
    "X-Requested-With": "XMLHttpRequest"
  };

  const cookie = includeCookie ? getDoubanCookie() : '';
  if (cookie) {
    headers.Cookie = cookie;
  }

  return headers;
}

function isDoubanForbidden(error) {
  return String(error?.message || '').includes('status: 403');
}

async function requestDouban(url, { keyword = '', referer = DOUBAN_MOBILE_REFERER } = {}) {
  const hasCookie = Boolean(getDoubanCookie());
  const requestConfig = hasCookie
    ? {
        label: 'cookie',
        headers: buildDoubanHeaders({ keyword, referer, includeCookie: true }),
        retries: 2,
      }
    : {
        label: 'default',
        headers: buildDoubanHeaders({ keyword, referer, includeCookie: false }),
        retries: 1,
      };

  try {
    const response = await httpGet(url, {
      method: 'GET',
      headers: requestConfig.headers,
      retries: requestConfig.retries,
    });

    if (response.status === 200) {
      return response;
    }

    throw new Error(`HTTP error! status: ${response.status}`);
  } catch (error) {
    if (hasCookie && isDoubanForbidden(error)) {
      log("warn", `[DOUBAN] 使用配置的 Cookie 请求仍命中 403: ${url}`);
    }
    throw error;
  }
}

// 豆瓣 API GET 请求
async function doubanApiGet(url, options = {}) {
  const doubanApi = "https://m.douban.com/rexxar/api/v2";

  try {
    const response = await requestDouban(`${doubanApi}${url}`, options);
    if (response.status != 200) return null;

    return response;
  } catch (error) {
    log("error", "[DOUBAN] GET API error:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    return null;
  }
}

// 豆瓣 API POST 请求
async function doubanApiPost(url, data={}) {
  const doubanApi = "https://api.douban.com/v2";

  try {
    const response = await httpPost(`${doubanApi}${url}`,
        JSON.stringify({...data, apikey: "0ac44ae016490db2204ce0a042db2916"}), {
      method: 'POST',
      headers: {
        "Referer": "https://api.douban.com",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });
    if (response.status != 200) return null;

    return response;
  } catch (error) {
    log("error", "[DOUBAN] POST API error:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
    return null;
  }
}

// 使用 豆瓣 API 查询片名
export async function searchDoubanTitles(keyword, count = 20) {
  const url = `/search?q=${encodeURIComponent(keyword)}&start=0&count=${count}&type=movie`;
  return await doubanApiGet(url, { keyword, referer: DOUBAN_MOBILE_REFERER });
}

// 使用 豆瓣 公开 API 查询片名
export async function searchDoubanTitlesByPublic(keyword, count = 20) {
  const url = `/movie/search`;
  const data = { q: keyword, start: 0, count: count };
  return await doubanApiPost(url, data);
}

// 使用 豆瓣 API 查询详情
export async function getDoubanDetail(doubanId) {
  const url = `/movie/${doubanId}?for_mobile=1`;
  return await doubanApiGet(url, { referer: `${DOUBAN_MOBILE_REFERER}${doubanId}/` });
}

// 通过 imdbId 使用 豆瓣 API 查询 doubanInfo
export async function getDoubanInfoByImdbId(imdbId) {
  const url = `/movie/imdb/${imdbId}`;
  return await doubanApiPost(url);
}

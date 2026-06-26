export const TABS = [
  { id: "preview", label: "配置预览" },
  { id: "logs", label: "日志查看" },
  { id: "api", label: "接口调试" },
  { id: "push", label: "推送弹幕" },
  { id: "request-records", label: "请求记录" },
  { id: "env", label: "系统配置" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export const PROTECTED_TABS: TabId[] = [
  "logs",
  "api",
  "push",
  "request-records",
  "env",
];

export const CATEGORY_LABELS: Record<string, string> = {
  api: "API配置",
  source: "源配置",
  match: "匹配配置",
  danmu: "弹幕配置",
  cache: "缓存配置",
  system: "系统配置",
};

export const CATEGORY_ORDER = ["api", "source", "match", "danmu", "cache", "system"];

export interface ApiEndpointConfig {
  id: string;
  name: string;
  method: "GET" | "POST";
  path: string;
  params: {
    name: string;
    label: string;
    type: "text" | "select";
    required: boolean;
    placeholder?: string;
    options?: string[];
  }[];
  hasBody?: boolean;
  bodyType?: "json";
}

export const API_ENDPOINTS: ApiEndpointConfig[] = [
  {
    id: "searchAnime",
    name: "搜索动漫",
    method: "GET",
    path: "/api/v2/search/anime",
    params: [
      {
        name: "keyword",
        label: "关键词 或 播放链接URL",
        type: "text",
        required: true,
        placeholder: "示例: 生万物 或 http://v.qq.com/x/cover/...",
      },
    ],
  },
  {
    id: "searchEpisodes",
    name: "搜索剧集",
    method: "GET",
    path: "/api/v2/search/episodes",
    params: [
      {
        name: "anime",
        label: "动漫名称",
        type: "text",
        required: true,
        placeholder: "示例: 生万物",
      },
      {
        name: "episode",
        label: "集",
        type: "text",
        required: false,
        placeholder: "示例: 1, movie",
      },
    ],
  },
  {
    id: "matchAnime",
    name: "匹配动漫",
    method: "POST",
    path: "/api/v2/match",
    params: [
      {
        name: "fileName",
        label: "文件名",
        type: "text",
        required: true,
        placeholder:
          "示例: 生万物 S02E08, 无忧渡.S02E08.2160p.WEB-DL.H265.DDP.5.1",
      },
    ],
    hasBody: true,
    bodyType: "json",
  },
  {
    id: "getBangumi",
    name: "获取番剧详情",
    method: "GET",
    path: "/api/v2/bangumi/:animeId",
    params: [
      {
        name: "animeId",
        label: "动漫ID",
        type: "text",
        required: true,
        placeholder: "示例: 236379",
      },
    ],
  },
  {
    id: "getComment",
    name: "获取弹幕",
    method: "GET",
    path: "/api/v2/comment/:commentId",
    params: [
      {
        name: "commentId",
        label: "弹幕ID",
        type: "text",
        required: true,
        placeholder: "示例: 10009",
      },
      {
        name: "format",
        label: "格式",
        type: "select",
        required: false,
        options: ["json", "xml"],
      },
      {
        name: "duration",
        label: "附带时长",
        type: "select",
        required: false,
        options: ["true", "false"],
      },
    ],
  },
  {
    id: "getSegmentComment",
    name: "获取分片弹幕",
    method: "POST",
    path: "/api/v2/segmentcomment",
    params: [
      {
        name: "body",
        label: "请求体 JSON",
        type: "text",
        required: true,
        placeholder:
          '{"type":"qq","segment_start":0,"segment_end":30000,"url":"..."}',
      },
    ],
    hasBody: true,
    bodyType: "json",
  },
];

export const LOG_CATEGORY_ORDER: string[] = [
  "system",
  "ai",
  "utils",
  "cache",
  "merge",
  "360kan",
  "aiyifan",
  "animeko",
  "bahamut",
  "bilibili",
  "custom",
  "dandan",
  "douban",
  "hanjutv",
  "iqiyi",
  "leshi",
  "maiduidui",
  "mango",
  "migu",
  "other",
  "renren",
  "sohu",
  "tencent",
  "tmdb",
  "vod",
  "xigua",
  "youku",
];

export const SPECIAL_ENV_KEYS = {
  COLOR_POOL: "COLOR_POOL",
  DANMU_OFFSET: "DANMU_OFFSET",
  CUSTOM_MERGE_RULES: "CUSTOM_MERGE_RULES",
  AI_API_KEY: "AI_API_KEY",
  BILIBILI_COOKIE: "BILIBILI_COOKIE",
  MERGE_SOURCE_PAIRS: "MERGE_SOURCE_PAIRS",
  PLATFORM_ORDER: "PLATFORM_ORDER",
  LIKE_SWITCH: "LIKE_SWITCH",
  REMEMBER_LAST_SELECT: "REMEMBER_LAST_SELECT",
} as const;

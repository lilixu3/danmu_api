> 一个可自托管的弹幕聚合 API 服务：支持多平台弹幕直接获取，兼容弹弹play 的搜索/匹配/详情/弹幕接口规范，并内置 Web UI 后台（配置/日志/接口调试/弹幕测试/推送弹幕/系统管理等）。
>
> 本仓库为 **lilixu3 的维护分支（fork）**：在上游基础上做了若干优化与 UI 重构，适合自用/公开部署/容器化运行。

<p align="center">
  <a href="https://github.com/lilixu3/danmu_api"><img src="https://img.shields.io/github/stars/lilixu3/danmu_api?style=flat-square" alt="stars"></a>
  <a href="https://github.com/lilixu3/danmu_api"><img src="https://img.shields.io/github/forks/lilixu3/danmu_api?style=flat-square" alt="forks"></a>
  <a href="https://github.com/lilixu3/danmu_api/blob/main/LICENSE"><img src="https://img.shields.io/github/license/lilixu3/danmu_api?style=flat-square" alt="license"></a>
  <a href="https://hub.docker.com/r/lilixu3/danmu-api"><img src="https://img.shields.io/docker/v/lilixu3/danmu-api?style=flat-square" alt="docker-version"></a>
  <a href="https://hub.docker.com/r/lilixu3/danmu-api"><img src="https://img.shields.io/docker/pulls/lilixu3/danmu-api?style=flat-square" alt="docker-pulls"></a>
</p>

---

## ✨ 特性概览


- **多平台弹幕聚合**：支持「爱优腾芒哔人韩巴」等弹幕直接获取，并可配置兜底第三方弹幕服务器。
- **弹弹play 兼容接口**：支持搜索、自动匹配、详情查询、弹幕获取等接口规范，便于各类播放器/插件对接。
- **输出格式**：支持 **JSON** / **Bilibili 标准 XML** 输出（`?format=xml` / `DANMU_OUTPUT_FORMAT=xml`）。
- **缓存与稳定性**：支持内存缓存 +（可选）Redis/Upstash 持久化，减少重复请求与冷启动影响；支持挂载 `.cache` 落盘。
- **弹幕处理能力**：支持弹幕去重、屏蔽词、数量采样、颜色/顶部底部弹幕转换等。
- **分片弹幕**：支持分片列表获取与单分片拉取（适配一些播放器的分片逻辑）。
- **Web UI 后台**：配置预览、日志查看、接口调试/弹幕测试、推送弹幕、系统管理等（详情见 `danmu_api/ui/README.md`）。
- **部署方式丰富**：本地 Node / Docker / Vercel / Netlify / Cloudflare / EdgeOne 等。

---

## 🚀 快速开始（Docker｜推荐）

> 镜像：`lilixu3/danmu-api:latest`

### 1) 最简启动（环境变量方式）

```bash
docker pull lilixu3/danmu-api:latest

docker run -d \
  --name danmu-api \
  -p 9321:9321 \
  -e TOKEN=87654321 \
  -e ADMIN_TOKEN=admin \
  --restart unless-stopped \
  lilixu3/danmu-api:latest
```

启动后测试：

- `http://{ip}:9321/87654321`
- `http://{ip}:9321/87654321/api/v2/search/anime?keyword=生万物`

> 若 `TOKEN` 为默认 `87654321`，多数情况下可不带 `{TOKEN}` 前缀直接请求：  
> `http://{ip}:9321/api/v2/search/anime?keyword=生万物`

---

### 2) 推荐方式：挂载配置 + 缓存落盘（支持热更新）

1. 复制示例配置：

```bash
cp ./config/.env.example ./config/.env
```

2. 编辑 `./config/.env`（示例）：

```env
TOKEN=87654321
ADMIN_TOKEN=admin

# 输出格式：json/xml
DANMU_OUTPUT_FORMAT=json

# 缓存（分钟）
SEARCH_CACHE_MINUTES=5
COMMENT_CACHE_MINUTES=5
```

3. 运行容器（挂载 `config/` 与 `.cache/`）：

```bash
docker run -d \
  --name danmu-api \
  -p 9321:9321 \
  -v $(pwd)/config:/app/config \
  -v $(pwd)/.cache:/app/.cache \
  --restart unless-stopped \
  lilixu3/danmu-api:latest
```

> ✅ 热更新说明：修改 `config/.env` 后服务会自动重新加载配置（无需重启容器/进程）。  
>（注意：若你只用 `-e` 传环境变量而不挂载 `config/.env`，则无法“热更新”。）

---

## 🧩 Docker Compose 示例

在仓库根目录新建 `docker-compose.yml`：

```yaml
services:
  danmu-api:
    image: lilixu3/danmu-api:latest
    container_name: danmu-api
    ports:
      - "9321:9321"
    volumes:
      - ./config:/app/config     # 在 ./config 下创建 .env
      - ./.cache:/app/.cache     # 缓存落盘（可选但推荐）
    restart: unless-stopped
```

启动：

```bash
docker compose up -d
```

---

## 🖥️ 本地运行（Node.js）

### 前置条件

- Node.js >= 18
- npm

### 启动

```bash
npm install
cp ./config/.env.example ./config/.env
npm start
```

或：

```bash
node ./danmu_api/server.js
```

默认服务地址：

- `http://{ip}:9321`（默认 `TOKEN=87654321`）

---

## 🧪 常用 API（选摘）

> 说明：如果你自定义了 `TOKEN` 且不为默认值，部分部署/配置下可能需要以 `/{TOKEN}` 作为前缀访问。

- `GET /api/v2/search/anime?keyword=xxx`：按关键字搜索
- `POST /api/v2/match`：自动匹配（支持 `@qiyi` 等语法指定平台优先级，也支持 AI 自动匹配）
- `GET /api/v2/search/episodes?anime=xxx`：搜索剧集信息
- `GET /api/v2/bangumi/:animeId`：获取详情
- `GET /api/v2/comment/:commentId?format=json|xml`：按 commentId 获取弹幕
- `GET /api/v2/comment?url={videoUrl}&format=json|xml`：按视频 URL 获取弹幕
- `POST /api/v2/segmentcomment?format=json`：根据 Segment JSON 拉取某个分片弹幕
- `GET /api/logs`：查看最近日志（最多 500 行）

---

## 🧩 分片弹幕（给需要分片的播放器/客户端）

- 在 `/api/v2/comment` 请求时可使用 `segmentflag=true` 获取分片列表
- 再通过 `/api/v2/segmentcomment` 请求单个分片弹幕

---

## 🛠 Web UI 后台

项目内置 Web UI 后台管理系统，可用于：

- 配置预览 / 部分平台配置
- 日志查看
- API 调试
- 推送弹幕
- 系统管理（需要设置 `ADMIN_TOKEN`）

详细说明见：[`danmu_api/ui/README.md`](./danmu_api/ui/README.md)

---

## ⚙️ 配置（常用环境变量）

完整变量清单请以 `config/.env.example` 为准。这里列出最常用的：

| 变量 | 说明 |
|---|---|
| `TOKEN` | API 访问令牌（不填默认 `87654321`） |
| `ADMIN_TOKEN` | 系统管理令牌（不填则无法使用系统管理功能） |
| `DANMU_OUTPUT_FORMAT` | `json` / `xml`（也可用 `?format=` 覆盖） |
| `DANMU_FONT_SIZE` | 弹幕字体大小（B站标准，范围 10-100，默认 25） |
| `DANMU_LIKE_PRESET` | 点赞显示预设：`default`（当前推荐）/`pink_under_1k`/`outline_under_1k`/`pink_only`/`outline_only`/`off`（关闭点赞显示） |
| `CONVERT_COLOR` | 颜色转换：`default`/`white`/`color` 或自定义十进制颜色列表 |
| `SEARCH_CACHE_MINUTES` / `COMMENT_CACHE_MINUTES` | 缓存时长（分钟，`0` 表示不缓存） |
| `SEARCH_CACHE_MAX_ITEMS` / `COMMENT_CACHE_MAX_ITEMS` | 缓存最大条目数（`0` 不限制） |
| `MAX_ANIMES` | 动漫标题缓存最大数量（默认 `100`，最小 `100`，最大 `1000`） |
| `RATE_LIMIT_MAX_REQUESTS` | 限流：同一 IP 1 分钟最大请求数（`0` 不限流） |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis（可选，用于持久化与稳定性） |
| `LOCAL_REDIS_URL` | 本地 Redis（可选，适用于 Docker/本地部署） |
| `SOURCE_ORDER` | 弹幕源优先级顺序（按需调整） |
| `REAL_TIME_PULL_DANDAN` | 弹弹第三方弹幕源实时拉取开关（默认 `false`），开启后会在 dandan 源请求时实时拉取其绑定的第三方弹幕源以覆盖旧缓存。 |
| `ANIME_TITLE_FILTER` | 剧名过滤正则（需启用 `ENABLE_ANIME_EPISODE_FILTER`，为空则不过滤） |
| `ANIME_TITLE_SIMPLIFIED` | 搜索时将繁体剧名自动转换为简体（默认 `false`） |
| `AI_BASE_URL` / `AI_MODEL` / `AI_API_KEY` | AI 自动匹配基础配置（可选） |
| `AI_MATCH_PROMPT` | AI 自动匹配提示词模板（可选，不填使用默认模板） |
| `OTHER_SERVER` | 兜底第三方弹幕服务器（可选） |
| `PROXY_URL` | 代理/反代地址（部分源/接口可用） |
| `LOCAL_PROXY_BIND` / `LOCAL_PROXY_TOKEN` | 本地正向代理辅助服务监听地址与鉴权（仅当 `PROXY_URL` 为正向代理时启用） |
| `ALLOW_PRIVATE_URLS` | 是否允许访问本地/内网 URL（默认 `false`，有 SSRF 风险） |
| `LOG_LEVEL` | 日志级别：`error` / `warn` / `info` / `debug` |

> 小提示：当 `PROXY_URL` 配置为正向代理时，会启动本地 5321 端口中转服务；若将 `LOCAL_PROXY_BIND` 设为 `0.0.0.0`，务必设置 `LOCAL_PROXY_TOKEN`（请求头 `x-proxy-token`）以避免开放代理风险。

---

## 📦 一键云部署（可选）

> 温馨提示：云平台环境变量变更通常需要重新部署才能生效；Docker 挂载 `config/.env` 才能热更新。

- Vercel  
  [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/lilixu3/danmu_api)

- Netlify  
  [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/lilixu3/danmu_api)

- Cloudflare Workers  
  [![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/lilixu3/danmu_api)

部署后请在平台控制台设置至少一个环境变量：

- `TOKEN`（必配，建议自定义强随机）
- `ADMIN_TOKEN`（建议配置，用于 UI 系统管理）

---

## 📱 相关项目

- Android 端一键运行（内置 Node.js）：`danmu-api-android`  
  https://github.com/lilixu3/danmu-api-android

---

## ⚠️ 免责声明

本项目仅用于学习与技术研究，请遵守当地法律法规与平台服务协议。请勿用于侵权/盗版传播等用途。  
如有侵权内容请联系删除。

---

## 🙏 致谢

- 上游项目：huangxd-/danmu_api（本仓库 fork 来源）
- 以及所有贡献者/依赖项目作者

---

## 📄 License

AGPL-3.0

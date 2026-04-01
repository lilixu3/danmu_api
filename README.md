> 一个可自托管的弹幕聚合 API 服务：支持多平台弹幕直接获取，兼容弹弹play 的搜索 / 匹配 / 详情 / 弹幕接口规范，并内置 Web UI 后台。
>
> 本仓库为 **lilixu3 的维护分支（fork）**：在上游基础上补了前端管理后台、运行时状态面板、在线更新 / 云端重部署、更多部署适配，以及一系列稳定性修复。

<p align="center">
  <a href="https://github.com/lilixu3/danmu_api"><img src="https://img.shields.io/github/stars/lilixu3/danmu_api?style=flat-square" alt="stars"></a>
  <a href="https://github.com/lilixu3/danmu_api"><img src="https://img.shields.io/github/forks/lilixu3/danmu_api?style=flat-square" alt="forks"></a>
  <a href="https://github.com/lilixu3/danmu_api/blob/main/LICENSE"><img src="https://img.shields.io/github/license/lilixu3/danmu_api?style=flat-square" alt="license"></a>
  <a href="https://hub.docker.com/r/lilixu3/danmu-api"><img src="https://img.shields.io/docker/v/lilixu3/danmu-api?style=flat-square" alt="docker-version"></a>
  <a href="https://hub.docker.com/r/lilixu3/danmu-api"><img src="https://img.shields.io/docker/pulls/lilixu3/danmu-api?style=flat-square" alt="docker-pulls"></a>
</p>

## 特性概览

- 支持多平台弹幕聚合，可直接获取爱优腾芒哔咪人韩巴等来源弹幕。
- 兼容弹弹play 的搜索、匹配、详情、弹幕和分片接口，便于播放器 / 插件直接接入。
- 支持 `json` / `xml` 两种输出格式，可通过查询参数或环境变量切换。
- 支持内存缓存、`.cache` 落盘、Upstash Redis、本地 Redis。
- 内置 Web UI，覆盖服务概览、日志、接口测试、弹幕测试、推送弹幕、访问记录、系统设置。
- 新增运行状态与版本面板，支持秒级刷新、版本检查、Docker 在线更新、云端重部署。
- 支持 Node.js、Docker、Vercel、Netlify、Cloudflare Workers、EdgeOne 等部署方式。

## 快速开始

### Docker 推荐用法

```bash
docker pull lilixu3/danmu-api:latest

docker run -d \
  --name danmu-api \
  -p 9321:9321 \
  -v $(pwd)/config:/app/config \
  -v $(pwd)/.cache:/app/.cache \
  -e TOKEN=87654321 \
  -e ADMIN_TOKEN=admin \
  --restart unless-stopped \
  lilixu3/danmu-api:latest
```

如果是 Docker 部署，建议先复制一份配置文件：

```bash
cp ./config/.env.example ./config/.env
```

启动后常用入口：

- API 根地址：`http://{ip}:9321`
- 普通 UI：`http://{ip}:9321/{TOKEN}`
- 管理员 UI：`http://{ip}:9321/{ADMIN_TOKEN}`

如果 `TOKEN` 仍为默认值 `87654321`，大多数 API 可以直接省略 token 前缀访问。

### Docker Compose 示例

```yaml
services:
  danmu-api:
    image: lilixu3/danmu-api:latest
    container_name: danmu-api
    ports:
      - "9321:9321"
    volumes:
      - ./config:/app/config
      - ./.cache:/app/.cache
    restart: unless-stopped
```

```bash
docker compose up -d
```

### 本地 Node.js 运行

要求：

- Node.js 18+
- npm

启动：

```bash
npm install
cp ./config/.env.example ./config/.env
npm start
```

默认监听 `9321` 端口，可通过 `DANMU_API_PORT` 改端口。

## 访问与权限模型

这个分支把 UI 和运行时接口拆成了“可公开读取”和“管理员写操作”两层：

- 普通访问令牌：`TOKEN`
  用于普通 API、普通 UI、接口测试、日志查看、运行状态查看。
- 管理员令牌：`ADMIN_TOKEN`
  用于环境变量修改、清缓存、云端重部署、Docker 在线更新、Cookie 写入、AI 连通性验证等写操作。

当前权限规则：

- `GET /api/runtime/info`：公开只读
- `POST /api/runtime/check-update`：公开只读
- `POST /api/runtime/update`：仅管理员
- `POST /api/deploy`：仅管理员
- `POST /api/env/*`：仅管理员
- `POST /api/cache/clear`：仅管理员

说明：

- 普通访客也能打开“运行状态与版本”面板查看当前运行状态和版本信息。
- 只有使用 `ADMIN_TOKEN` 访问时，前端才会显示可执行的在线更新 / 重部署能力。

## Web UI 现在包含什么

详细说明见 [danmu_api/ui/README.md](./danmu_api/ui/README.md)。

当前 UI 模块：

- 服务概览：接入地址、模式、运行状态、版本、已配置项统计
- 运行日志：筛选、搜索、自动刷新、导出、清空
- 接口测试：直接调用搜索、匹配、详情、弹幕、分片接口
- 弹幕测试：自动匹配 / 手动搜索、热力图、统计、导出
- 推送弹幕：联动播放器刷新
- 访问记录：最近请求历史和今日请求总数
- 系统设置：环境变量、Cookie 管理、AI 连通性测试、缓存清理、重部署

## 运行状态、版本检查与在线更新

这个分支新增了完整的运行时面板。

### 面板能力

- 侧边栏与详情弹窗都是秒级刷新。
- 弹窗刷新时会保留已展开的详情区块，不会因为轮询自动收起。
- 会显示当前版本、最新版本、运行状态、访问模式、资源指标、更新日志。

### 不同运行模式下的能力

| 运行模式 | 自动识别方式 | CPU / 内存 / 网络 | 版本检查 | 在线更新 / 重部署 |
|---|---|---|---|---|
| `node` | 本地 Node.js 运行 | 支持 | 支持 | 不支持 |
| `docker` | 检测到 Docker 容器 / socket / 显式 `RUNTIME_MODE=docker` | 支持 | 支持 | 支持 Docker 在线更新 |
| `cloud` | Vercel / Netlify / Cloudflare / EdgeOne 等云平台，或显式 `RUNTIME_MODE=cloud` | 不支持 | 支持 | 支持云端重部署 |

### Docker 在线更新需要什么

至少满足下面几个条件：

- `ENABLE_RUNTIME_CONTROL=true`
- 容器内能访问 Docker socket
- 建议挂载：`-v /var/run/docker.sock:/var/run/docker.sock`

可选但推荐的变量：

- `DOCKER_SOCKET_PATH`
- `DOCKER_CONTAINER_NAME`
- `DOCKER_IMAGE_NAME`
- `DOCKER_KEEP_BACKUP`

说明：

- `DOCKER_CONTAINER_NAME` 不填时，会尝试通过当前容器 hostname 自动识别。
- `DOCKER_IMAGE_NAME` 默认会使用 `lilixu3/danmu-api` 做版本检查。

### 云平台的表现差异

- 云平台模式下不会展示 CPU / 内存 / 网络指标，这是预期行为。
- 管理员可以触发“重新部署”，前提是已配置对应平台的 `DEPLOY_PLATFROM_*` 参数。
- 只读文件系统环境下，运行时状态会自动从磁盘缓存回退到内存缓存，不会因为 `.cache` 不可写而导致运行时面板报错。

## 热更新与需要重启的变量

Node / Docker 挂载 `config/.env` 后，大部分业务配置会自动热加载，不需要重启进程。

但下面这类“启动期变量”建议修改后主动重启：

- `DANMU_API_PORT`
- `LOCAL_PROXY_BIND`
- `LOCAL_PROXY_TOKEN`
- 首次启用或关闭正向代理时的 `PROXY_URL`

原因：

- 这些变量会影响监听端口、代理辅助服务是否启动、代理绑定地址和鉴权方式。
- 进程虽然会重新读取 `.env`，但不会自动重新绑定监听端口或重新创建 5321 辅助代理服务。

## 常用 API

### 兼容弹弹play 的业务接口

- `GET /api/v2/search/anime?keyword=xxx`
- `GET /api/v2/search/episodes?anime=xxx`
- `POST /api/v2/match`
- `GET /api/v2/bangumi/:animeId`
- `GET /api/v2/comment/:commentId?format=json|xml`
- `GET /api/v2/comment?url={videoUrl}&format=json|xml`
- `GET /api/v2/comment/:commentId/duration`
- `POST /api/v2/segmentcomment?format=json`

### UI / 系统接口

- `GET /api/config`
- `GET /api/logs`
- `GET /api/reqrecords`
- `POST /api/logs/clear`
- `POST /api/cache/clear`
- `POST /api/deploy`
- `GET /api/runtime/info`
- `POST /api/runtime/check-update`
- `POST /api/runtime/update`
- `POST /api/env/set`
- `POST /api/env/add`
- `POST /api/env/del`
- `GET /api/cookie/status`
- `POST /api/cookie/*`
- `POST /api/ai/verify`

## 环境变量说明

完整示例和注释见 [config/.env.example](./config/.env.example)。

### 基础与权限

| 变量 | 说明 |
|---|---|
| `TOKEN` | 普通访问令牌，默认 `87654321` |
| `ADMIN_TOKEN` | 管理员令牌，不填则无法执行管理写操作 |
| `DANMU_API_PORT` | Node / Docker 主服务监听端口，默认 `9321` |
| `RATE_LIMIT_MAX_REQUESTS` | 同一 IP 每分钟最大请求数，`0` 表示不限流 |
| `IP_BLACKLIST` | IP 黑名单，支持精确值、CIDR、正则 |

### 源、代理与平台接入

| 变量 | 说明 |
|---|---|
| `SOURCE_ORDER` | 数据源顺序 |
| `OTHER_SERVER` | 第三方弹幕服务器兜底地址 |
| `CUSTOM_SOURCE_API_URL` | 自定义弹幕源地址，启用后还要把 `custom` 加入 `SOURCE_ORDER` |
| `VOD_SERVERS` | VOD 站点配置 |
| `VOD_RETURN_MODE` | `all` 或 `fastest` |
| `VOD_REQUEST_TIMEOUT` | VOD 请求超时 |
| `BILIBILI_COOKIE` | B 站 Cookie，UI 支持扫码登录、校验、刷新 |
| `YOUKU_CONCURRENCY` | 优酷并发数 |
| `PROXY_URL` | 代理 / 反代配置，支持正向代理、万能反代、平台专用反代 |
| `LOCAL_PROXY_BIND` | 本地 5321 辅助代理绑定地址 |
| `LOCAL_PROXY_TOKEN` | 本地 5321 辅助代理鉴权 token |
| `ALLOW_PRIVATE_URLS` | 是否允许访问内网 / 本地 URL，默认 `false` |
| `TMDB_API_KEY` | 用于 TMDB 辅助译名 / 标题转换场景 |

### 匹配与标题处理

| 变量 | 说明 |
|---|---|
| `PLATFORM_ORDER` | 自动匹配优选平台 |
| `MERGE_SOURCE_PAIRS` | 多源合并规则 |
| `REAL_TIME_PULL_DANDAN` | 弹弹绑定第三方源时是否实时拉取 |
| `ENABLE_ANIME_EPISODE_FILTER` | 是否启用剧名 / 集标题过滤 |
| `ANIME_TITLE_FILTER` | 剧名过滤规则 |
| `EPISODE_TITLE_FILTER` | 集标题过滤规则 |
| `STRICT_TITLE_MATCH` | 是否启用严格标题匹配 |
| `TITLE_TO_CHINESE` | 外语标题转中文，通常配合 `TMDB_API_KEY` |
| `ANIME_TITLE_SIMPLIFIED` | 搜索时繁转简 |
| `TITLE_MAPPING_TABLE` | 标题映射表 |
| `TITLE_PLATFORM_OFFSET_TABLE` | 按剧名和平台配置时间轴偏移 |
| `AI_BASE_URL` | AI 接口地址，支持 OpenAI 兼容服务 |
| `AI_MODEL` | AI 模型名 |
| `AI_API_KEY` | AI 密钥 |
| `AI_MATCH_PROMPT` | 自定义 AI 匹配提示词 |
| `AI_TRUST_MATCH_RESULT` | 是否完全信任 AI 结论，开启后 AI 未命中时不再走常规兜底匹配 |

### 弹幕处理

| 变量 | 说明 |
|---|---|
| `BLOCKED_WORDS` | 屏蔽词 |
| `GROUP_MINUTE` | 去重时间窗口 |
| `DANMU_LIMIT` | 弹幕采样上限，单位 k |
| `DANMU_LIKE_PRESET` | 点赞显示预设 |
| `LIKE_SWITCH` | 是否显示点赞标记 |
| `DANMU_SIMPLIFIED_TRADITIONAL` | 简繁转换 |
| `CONVERT_TOP_BOTTOM_TO_SCROLL` | 顶部 / 底部弹幕转滚动 |
| `CONVERT_COLOR` | 颜色转换 |
| `DANMU_FONT_SIZE` | 字号 |
| `DANMU_OUTPUT_FORMAT` | 全局默认输出格式 |
| `DANMU_PUSH_URL` | 推送弹幕默认地址 |

### 缓存与状态保持

| 变量 | 说明 |
|---|---|
| `SEARCH_CACHE_MINUTES` / `COMMENT_CACHE_MINUTES` | 搜索 / 弹幕缓存时间 |
| `SEARCH_CACHE_MAX_ITEMS` / `COMMENT_CACHE_MAX_ITEMS` | 搜索 / 弹幕缓存容量 |
| `REMEMBER_LAST_SELECT` | 记住手动选择结果 |
| `MAX_LAST_SELECT_MAP` | 上次选择映射上限 |
| `MAX_ANIMES` | 动漫缓存上限 |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis |
| `LOCAL_REDIS_URL` | 本地 Redis |

### 运行时与部署控制

| 变量 | 说明 |
|---|---|
| `RUNTIME_MODE` | `docker` / `node` / `cloud`，留空自动识别 |
| `ENABLE_RUNTIME_CONTROL` | 是否启用运行时在线控制能力 |
| `DOCKER_SOCKET_PATH` | Docker socket 路径 |
| `DOCKER_CONTAINER_NAME` | 目标容器名 |
| `DOCKER_IMAGE_NAME` | 版本检查 / 在线更新使用的镜像名 |
| `DOCKER_KEEP_BACKUP` | 在线更新后是否保留旧容器 |
| `DEPLOY_PLATFROM_ACCOUNT` | 云平台账号 / 账户 ID |
| `DEPLOY_PLATFROM_PROJECT` | 云平台项目 ID |
| `DEPLOY_PLATFROM_TOKEN` | 云平台访问令牌 |
| `NODE_TLS_REJECT_UNAUTHORIZED` | HTTPS 证书校验开关，`0` 表示忽略 |

## 云端重部署支持

当前 UI 中已接入的云平台部署控制：

- Vercel
- Netlify
- Cloudflare Workers
- EdgeOne Pages

说明：

- 这些平台需要先配置对应的 `DEPLOY_PLATFROM_*` 参数，管理员才能在 UI 中修改环境变量并触发重部署。
- Node / Docker 部署不走云端重部署接口，通常是直接热加载或本地生效。

## 相关项目

- Android 端一键运行（内置 Node.js）：`danmu-api-android`
  https://github.com/lilixu3/danmu-api-android

## 免责声明

本项目仅用于学习与技术研究，请遵守当地法律法规与平台服务协议。请勿用于侵权 / 盗版传播等用途。
如有侵权内容请联系删除。

## 致谢

- 上游项目：huangxd-/danmu_api
- 以及所有贡献者 / 依赖项目作者

## License

见 [LICENSE](./LICENSE)。

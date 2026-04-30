# UI 系统使用说明

这个目录对应项目内置的 Web UI 管理后台。它不是单独的前端项目，而是直接由服务端输出 HTML / CSS / JS，用来管理当前弹幕 API 服务实例。

## UI 入口与权限

访问方式：

- 普通界面：`http://your-domain/{TOKEN}`
- 管理员界面：`http://your-domain/{ADMIN_TOKEN}`

补充说明：

- 当 `TOKEN` 仍为默认值 `87654321` 时，很多普通接口可以省略 token 前缀。
- UI 根路径 `/` 也可以打开页面，但是否具备管理能力取决于当前访问 token。
- 只有 `ADMIN_TOKEN` 访问下，才允许修改环境变量、清缓存、重部署、在线更新、保存 Cookie、执行 AI 连通性测试等写操作。

## 当前 UI 包含的模块

### 1. 服务概览

用于快速查看：

- 接入地址
- 当前访问模式
- 服务状态
- 版本状态
- 已识别配置项和已填写配置项数量
- 部署配置状态

### 2. 运行日志

支持：

- 手动刷新
- 自动刷新
- 关键字搜索
- 级别筛选
- 自动换行 / 自动滚动
- 导出日志
- 清空日志

说明：

- 非管理员查看日志时，日志中的 IP 会做脱敏处理。
- 清空日志属于管理员操作。

### 3. API 测试平台

分为两种模式：

- 接口测试
- 弹幕测试

接口测试覆盖：

- `/api/v2/search/anime`
- `/api/v2/search/episodes`
- `/api/v2/match`
- `/api/v2/bangumi/:animeId`
- `/api/v2/comment/:commentId`
- `/api/v2/comment?url=...`
- `/api/v2/segmentcomment`

弹幕测试提供：

- 自动匹配测试
- 手动搜索测试
- 弹幕统计
- 高能热力图
- 类型过滤
- JSON / XML 导出

### 4. 推送弹幕

用于把当前匹配到的弹幕推送给播放器。

典型场景：

- OK 影视
- 支持 HTTP 刷新的本地播放器

默认地址可通过 `DANMU_PUSH_URL` 预填。

### 5. 访问记录

显示最近请求历史，包括：

- 请求时间
- 请求方法
- 请求路径
- 请求参数
- 请求来源 IP
- 今日请求总数

### 6. 系统设置

这是管理员模块，包含：

- 环境变量查看 / 修改 / 删除
- 云平台环境变量写回
- 缓存清理
- 云端重部署
- Bilibili Cookie 管理
- AI 连通性测试

## 运行状态与版本面板

这是近期新增的重点功能。

入口：

- 侧边栏状态卡片
- 桌面端首页版本标签
- 移动端版本徽章

面板内容：

- 当前版本
- 最新版本
- 运行时类型
- 运行状态
- 当前访问身份（只读 / 管理员）
- CPU / 内存 / 网络指标
- 当前更新阶段
- 更新日志

当前行为：

- 侧边栏状态卡片秒级刷新
- 详情弹窗打开后也会秒级刷新
- 展开的“服务详情”和“更新日志”在刷新时会保留，不会自动收起

权限规则：

- `GET /api/runtime/info`：公开只读
- `POST /api/runtime/check-update`：公开只读
- `POST /api/runtime/update`：管理员写操作

也就是说：

- 普通访客可以查看版本和运行状态
- 只有管理员可以执行在线更新或云端重部署

## 不同部署形态下的表现

### Node.js 本地模式

- 可查看 CPU / 内存
- 可查看版本
- 不支持在线更新
- 配置文件改动大多可热加载

### Docker 模式

- 可查看 CPU / 内存 / 网络
- 可检查镜像版本
- 可执行 Docker 在线更新

要启用 Docker 在线更新，通常需要：

- `ENABLE_RUNTIME_CONTROL=true`
- 挂载 `/var/run/docker.sock`
- 根据需要配置 `DOCKER_CONTAINER_NAME`
- 根据需要配置 `DOCKER_IMAGE_NAME`

### 云平台模式

- 可查看版本和状态
- 不显示 CPU / 内存 / 网络指标
- 可触发云端重部署

当前文档对应的云平台部署控制能力已接入：

- Vercel
- Netlify
- Cloudflare Workers
- EdgeOne Pages

说明：

- 云平台重部署依赖 `DEPLOY_PLATFROM_ACCOUNT`、`DEPLOY_PLATFROM_PROJECT`、`DEPLOY_PLATFROM_TOKEN`
- 如果未配置这些参数，系统设置页会提示缺失项

## 云平台环境变量与在线重部署

这一节专门回答两个问题：

| 平台 | DEPLOY_PLATFROM_ACCOUNT | DEPLOY_PLATFROM_PROJECT | DEPLOY_PLATFROM_TOKEN |
|------|----------------------|----------------------|---------------------|
| Vercel | ❌ | ✅ | ✅ |
| Netlify | ✅ | ✅ | ✅ |
| EdgeOne | ❌ | ✅ | ✅ |
| Cloudflare | ✅ | ✅ | ✅ |
| Hugging Face Spaces | ✅ | ✅ | ✅ |
| Node.js | ❌ | ❌ | ❌ |
| Docker | ❌ | ❌ | ❌ |

- 哪些最小环境变量必须先手动配好，前端才能开始改配置
- 各平台里的 `DEPLOY_PLATFROM_*` 到底分别该填什么

先记住一条总规则：

### 5. Hugging Face Spaces 平台

#### 需要的变量
- `DEPLOY_PLATFROM_ACCOUNT`: Hugging Face 用户名或组织名
- `DEPLOY_PLATFROM_PROJECT`: Space 名称
- `DEPLOY_PLATFROM_TOKEN`: User Access Token

#### 获取步骤

**获取 Account 与 Space 名称**

1. 打开你的 Hugging Face Space 页面
2. Space 地址格式为 `https://huggingface.co/spaces/{account}/{space}`
3. `{account}` 填入 `DEPLOY_PLATFROM_ACCOUNT`，`{space}` 填入 `DEPLOY_PLATFROM_PROJECT`

**获取 User Access Token (`DEPLOY_PLATFROM_TOKEN`)**

1. 登录 [Hugging Face Access Tokens](https://huggingface.co/settings/tokens)
2. 创建 Fine-grained token 或 Write token
3. 如果使用 Fine-grained token，请授予目标 Space 的写入权限
4. **立即复制并保存** Token(只显示一次)

---

### 各平台变量获取详细步骤

- 第一次启用管理员 UI 时，必须先在云平台控制台里手动写入 `ADMIN_TOKEN`
- 然后使用 `/{ADMIN_TOKEN}` 打开页面
- 只有这样，系统设置页里的环境变量写回、云端重部署、Cookie 保存、AI 连通性测试这些管理员操作才会出现并可执行

### 所有云平台都要先满足的条件

| 项目 | 是否必需 | 作用 |
|---|---|---|
| `TOKEN` | 建议 | 普通 UI / API 访问令牌 |
| `ADMIN_TOKEN` | 必需 | 管理员 UI 入口，不配置就没有管理员能力 |
| `DEPLOY_PLATFROM_*` | 视平台而定 | 让 UI 能调用平台 API 写回环境变量并触发重部署 |
| `RUNTIME_MODE=cloud` | 可选 | 一般不需要；只有运行时识别失败时再补 |

补充说明：

- Vercel / Netlify / Cloudflare / EdgeOne 这类部署，真正生效的是平台控制台里的环境变量，不是本地 `config/.env`
- Node / Docker 可以热加载多数配置；云平台通常要重新部署后，新实例才会读取到改动
- 运行状态面板的只读信息不要求 `ADMIN_TOKEN`，但写操作一定要求

### 平台字段含义总览

| 平台 | `DEPLOY_PLATFROM_ACCOUNT` | `DEPLOY_PLATFROM_PROJECT` | `DEPLOY_PLATFROM_TOKEN` |
|---|---|---|---|
| Vercel | 不需要 | Vercel Project ID，通常以 `prj_` 开头 | Vercel Access Token |
| Netlify | Team slug 或 account ID | Site ID，Netlify UI 中也叫 Project ID | Netlify Personal Access Token |
| Cloudflare Workers | Cloudflare Account ID | Worker 脚本名 | Cloudflare API Token |
| EdgeOne Pages | 当前实现不使用，可留空 | EdgeOne Pages `ProjectId` | EdgeOne Pages API Token |

### Vercel

推荐最小配置：

```env
TOKEN=your-token
ADMIN_TOKEN=your-admin-token
DEPLOY_PLATFROM_PROJECT=prj_xxxxxxxxxxxx
DEPLOY_PLATFROM_TOKEN=your-vercel-access-token
```

在哪里找：

- `DEPLOY_PLATFROM_PROJECT`
  进入项目后打开 `Settings -> General -> Project ID`
- `DEPLOY_PLATFROM_TOKEN`
  进入账号 Token 页面：<https://vercel.com/account/tokens>
- 环境变量页面
  进入项目后打开 `Settings -> Environment Variables`
- 部署记录页面
  进入项目后打开 `Deployments`

官方文档：

- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Vercel General Settings](https://vercel.com/docs/projects/project-configuration/general-settings)
- [How do I use a Vercel API access token?](https://examples.vercel.com/guides/how-do-i-use-a-vercel-api-access-token)

实现说明：

- 当前项目对 Vercel 的环境变量读写使用的是 Project API，所以这里必须填 Project ID，不是项目名。
- 触发“重新部署”时，会基于最近一次生产部署重新发起部署。
- 按 Vercel 官方说明，环境变量改动不会自动作用到旧部署，所以前端修改完后仍需要重部署，这也是 UI 里会继续提供“重新部署”按钮的原因。

### Netlify

推荐最小配置：

```env
TOKEN=your-token
ADMIN_TOKEN=your-admin-token
DEPLOY_PLATFROM_ACCOUNT=your-team-slug
DEPLOY_PLATFROM_PROJECT=your-site-id
DEPLOY_PLATFROM_TOKEN=your-netlify-pat
```

在哪里找：

- `DEPLOY_PLATFROM_ACCOUNT`
  推荐直接填 Team slug；按 `Team settings -> General -> Team information` 查找
- `DEPLOY_PLATFROM_PROJECT`
  按 `Project configuration -> General -> Project information` 查找 Project ID
- `DEPLOY_PLATFROM_TOKEN`
  打开 Personal Access Token 页面：<https://app.netlify.com/user/applications#personal-access-tokens>
- 环境变量页面
  打开 `Project configuration -> Environment variables`
- 部署记录页面
  打开 `Deploys`

官方文档：

- [Netlify environment variables overview](https://docs.netlify.com/build/environment-variables/overview/)
- [Get started with the Netlify API](https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/)
- [Get started with Netlify CLI](https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/)

实现说明：

- 当前项目调用的是 Netlify Accounts / Env API，因此 `DEPLOY_PLATFROM_ACCOUNT` 建议直接填 team slug 或 account ID。
- `DEPLOY_PLATFROM_PROJECT` 实际上传给 API 的是 `site_id`，所以这里必须填 Site ID / Project ID。
- Netlify 的环境变量改动通常需要新的 deploy/build 才会体现在运行实例里，所以前端改完后要继续触发一次“重新部署”。

### Cloudflare Workers

推荐最小配置：

```env
TOKEN=your-token
ADMIN_TOKEN=your-admin-token
DEPLOY_PLATFROM_ACCOUNT=your-account-id
DEPLOY_PLATFROM_PROJECT=your-worker-name
DEPLOY_PLATFROM_TOKEN=your-cloudflare-api-token
```

在哪里找：

- `DEPLOY_PLATFROM_ACCOUNT`
  进入 `Workers & Pages` 页面后，可在账号信息区域看到 Account ID
- `DEPLOY_PLATFROM_PROJECT`
  填当前 Worker 的脚本名
- `DEPLOY_PLATFROM_TOKEN`
  打开 API Token 页面：<https://dash.cloudflare.com/profile/api-tokens>
- 环境变量页面
  进入 `Workers & Pages -> 你的 Worker -> Settings -> Variables and Secrets`

官方文档：

- [Find account and zone IDs](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/)
- [Create API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Cloudflare Workers environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)

实现说明：

- 当前项目这里走的是 Workers Script Settings API，不是通用的 Pages 项目环境变量接口。
- 所以 `DEPLOY_PLATFROM_PROJECT` 应填 Worker 脚本名，不是域名，也不是 Pages 自定义项目标题。
- 当前写回逻辑会把变量按普通文本绑定写入 Worker 设置，更适合一般配置项；如果你对 Cloudflare Secret 的掩码管理要求很高，建议敏感变量仍优先在控制台手动维护。
- Cloudflare 这里没有额外的 `/api/deploy` 动作，项目当前实现把环境变量写回视为平台侧立即接管，前端重点是“写回变量”而不是单独触发一次云构建。

### EdgeOne Pages

推荐最小配置：

```env
TOKEN=your-token
ADMIN_TOKEN=your-admin-token
DEPLOY_PLATFROM_PROJECT=your-project-id
DEPLOY_PLATFROM_TOKEN=your-edgeone-pages-api-token
```

在哪里找：

- `DEPLOY_PLATFROM_TOKEN`
  官方文档对应的控制台入口是 `API Token` 标签页，文档入口：<https://pages.edgeone.ai/document/api-token>
- 环境变量页面
  进入项目后查看 `Project Settings`
- 部署记录 / 手动部署页面
  进入 `Deployments` 或对应部署管理页
- `DEPLOY_PLATFROM_PROJECT`
  这里要求的是 Pages API 使用的 `ProjectId`

官方文档：

- [API Token](https://pages.edgeone.ai/document/api-token)
- [Project Management](https://pages.edgeone.ai/document/project-management)
- [Build Guide](https://pages.edgeone.ai/document/build-guide)
- [Manage Deploys](https://pages.edgeone.ai/document/manage-deploys)

实现说明：

- 当前实现只实际使用 `DEPLOY_PLATFROM_PROJECT` 和 `DEPLOY_PLATFROM_TOKEN`，`DEPLOY_PLATFROM_ACCOUNT` 可以留空。
- 这里要求填写的是 `ProjectId`，不是项目显示名。官方文档目前没有把固定页面位置写得很死，所以如果你在控制台里没有直接看到该字段，建议以项目 API 返回值或控制台内部请求里显示的 `ProjectId` 为准。
- 当前在线重部署请求固定使用 `main` 分支；如果你的生产分支不是 `main`，前端触发部署可能不会落到正确分支，这种情况下建议继续在 EdgeOne 控制台手动发起部署。

### 推荐的启用顺序

1. 先在云平台控制台手动配置 `TOKEN`、`ADMIN_TOKEN` 和对应 `DEPLOY_PLATFROM_*`
2. 部署完成后，用 `/{ADMIN_TOKEN}` 打开管理员 UI
3. 先在系统设置页检查“部署配置状态”是否完整
4. 再使用前端继续修改其他业务环境变量
5. 修改完后，按平台触发“重新部署”，或等待平台自身接管新配置

## Bilibili Cookie 管理

当你在系统设置里编辑 `BILIBILI_COOKIE` 时，UI 会切换到专用编辑面板。

支持：

- 获取当前 Cookie 状态
- 扫码登录
- 校验 Cookie 有效性
- 使用 `refresh_token` 刷新 Cookie
- 保存到当前部署环境

说明：

- 推荐直接用扫码登录，自动填入完整 Cookie。
- 手动填写时，建议至少包含 `SESSDATA` 和 `bili_jct`。

## AI 连通性验证

当你在系统设置里配置 AI 相关变量后，可以直接在 UI 中测试连通性。

相关变量：

- `AI_BASE_URL`
- `AI_MODEL`
- `AI_API_KEY`
- `AI_MATCH_PROMPT`
- `AI_TRUST_MATCH_RESULT`

用途：

- 验证当前 AI 配置是否可用
- 辅助排查模型地址、密钥、响应格式是否正确

## 哪些变量适合在 UI 改，哪些不适合

适合在 UI 中修改的：

- 大部分业务环境变量
- 平台密钥
- 缓存、匹配、弹幕处理类参数
- Cookie、AI、运行时控制参数

建议直接在部署平台或容器启动参数中管理的：

- `DANMU_API_PORT`
- `LOCAL_PROXY_BIND`
- `LOCAL_PROXY_TOKEN`
- 首次启用 / 关闭正向代理时的 `PROXY_URL`

原因：

- 这些变量会影响监听端口或 5321 辅助代理服务是否启动。
- 改完后通常需要重启进程或重新部署，UI 修改后也不会自动重绑监听。

## UI 使用到的接口

### 只读接口

- `GET /api/config`
- `GET /api/logs`
- `GET /api/reqrecords`
- `GET /api/runtime/info`
- `POST /api/runtime/check-update`
- `GET /api/cookie/status`

### 管理写接口

- `POST /api/logs/clear`
- `POST /api/cache/clear`
- `POST /api/deploy`
- `POST /api/runtime/update`
- `POST /api/env/set`
- `POST /api/env/add`
- `POST /api/env/del`
- `POST /api/cookie/qr/generate`
- `POST /api/cookie/qr/check`
- `POST /api/cookie/verify`
- `POST /api/cookie/save`
- `POST /api/cookie/clear`
- `POST /api/cookie/refresh`
- `POST /api/cookie/refresh-token`
- `POST /api/ai/verify`

## CSS 架构维护指南

当前 UI 样式已按职责拆分，建议按下面的入口维护：

- `css/tokens.css.js`：全局设计变量
- `css/foundation.css.js`：重置、布局骨架、页脚与加载层
- `css/shell.css.js`：应用壳层、侧边栏、导航、版本卡
- `css/components-shared.css.js`：按钮、卡片、模态等复用组件
- `css/forms-controls.css.js`：表单控件
- `css/feature-overview.css.js`：服务概览与日志相关样式
- `css/feature-settings.css.js`：系统设置、运行状态弹窗、Cookie / AI 编辑器
- `css/feature-api.css.js`：接口测试与弹幕测试
- `css/status.css.js`：状态类样式
- `css/theme-dark.css.js`：深色模式补充覆盖
- `css/responsive.css.js`：响应式与移动端适配

维护约定：

1. 新样式优先放到对应模块文件，不要把不同功能继续堆在一起。
2. 深色模式差异统一放到 `theme-dark.css.js`。
3. 响应式规则统一放到 `responsive.css.js`。
4. 新功能页建议新增 `feature-xxx.css.js`，不要继续把大块样式塞回旧文件。
5. 不要在已废弃文件 `base.css.js`、`colors.css.js`、`components.css.js`、`cookie-editor.css.js`、`dynamic.css.js`、`forms.css.js`、`mode-badge.css.js` 中继续追加样式。

## 常见问题

### 运行状态面板提示 `Unauthorized`

先确认：

- 你访问的是当前服务实例，而不是其他反代路径
- 反代没有把 `/api/runtime/*` 拦掉
- 如果是管理员操作，当前 URL 使用的是 `ADMIN_TOKEN`

### 运行状态面板提示 `.cache` 写入失败

在只读文件系统环境下，运行时状态现在会自动回退到内存态。
如果仍报错，通常是部署环境把请求打到了旧版本实例，或者服务还没有完成新版本发布。

### 云平台看不到 CPU / 内存 / 网络

这是预期行为。
云平台运行时只提供版本和状态读取，不提供宿主机资源指标。

### 系统设置页不能执行重部署

检查下面几项：

- 是否使用 `ADMIN_TOKEN` 访问
- 是否已配置 `DEPLOY_PLATFROM_*`
- 当前部署平台是否在已接入的支持列表中

### Docker 在线更新按钮不可用

检查下面几项：

- 是否设置了 `ENABLE_RUNTIME_CONTROL=true`
- 是否挂载了 docker socket
- 容器是否能识别当前自身容器名
- 是否使用 `ADMIN_TOKEN` 访问
